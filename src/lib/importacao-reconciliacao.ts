/**
 * Etapa 3 — Sinais, tipos e reconciliação financeira.
 *
 * Módulo isolado de propósito: transforma lançamentos já classificados
 * (Etapa 1) em resumos e conferências, sem tocar em extração de PDF/OCR
 * nem na tela de importação (isso fica para etapas seguintes).
 *
 * Toda a matemática monetária é feita em centavos (inteiros) para nunca
 * introduzir erro de ponto flutuante.
 */
import type { LancamentoImportadoCompleto, TipoLancamentoImportado } from "./importacao-modelo";

/** Agrupamento amplo usado na conferência: toda despesa é dívida, todo o resto é crédito. */
export type CategoriaFinanceira = "despesa" | "pagamento" | "estorno" | "credito";

/**
 * Decide a categoria de conferência a partir do tipo semântico já classificado
 * (Etapa 1). Nunca olha para o sinal bruto do documento — o tipo manda.
 */
export function categoriaFinanceira(tipo: TipoLancamentoImportado): CategoriaFinanceira {
  switch (tipo) {
    case "pagamento":
      return "pagamento";
    case "estorno":
      return "estorno";
    case "outro_credito":
      return "credito";
    // compra, tarifa, juros, multa, imposto, seguro, saque e indefinido são
    // todos cobranças contra o titular — tratadas como despesa para fins de
    // conferência, mesmo que o tipo semântico específico seja preservado
    // no lançamento para auditoria.
    default:
      return "despesa";
  }
}

export type ResumoImportacao = {
  /** Lançamentos aceitos como itens válidos (nem ignorados, nem descartados). */
  encontrados: number;
  /** Dentre os encontrados, quantos exigem revisão humana (baixa confiança). */
  duvidosos: number;
  /** Linhas do documento reconhecidas como resumo/ruído e descartadas antes de virar lançamento. */
  ignorados: number;
  despesasCentavos: number;
  pagamentosCentavos: number;
  estornosCentavos: number;
  creditosCentavos: number;
  /** Soma líquida assinada: despesas negativas, pagamentos/estornos/créditos positivos. */
  saldoCentavos: number;
};

/**
 * Resume uma lista de lançamentos já classificados. `linhasIgnoradas` é o
 * número de linhas do documento identificadas como resumo/ruído (ver
 * `ehLinhaResumoFatura`) e que nunca chegaram a virar lançamento — contadas
 * à parte para que "resumos não virem despesas" fique visível no resultado.
 */
export function resumirLancamentos(
  lancamentos: readonly LancamentoImportadoCompleto[],
  linhasIgnoradas = 0,
): ResumoImportacao {
  const resumo: ResumoImportacao = {
    encontrados: lancamentos.length,
    duvidosos: 0,
    ignorados: Math.max(0, linhasIgnoradas),
    despesasCentavos: 0,
    pagamentosCentavos: 0,
    estornosCentavos: 0,
    creditosCentavos: 0,
    saldoCentavos: 0,
  };

  for (const lancamento of lancamentos) {
    const valor = lancamento.valorNormalizadoCentavos ?? 0;
    resumo.saldoCentavos += valor;
    if (lancamento.exigeRevisao) resumo.duvidosos += 1;

    switch (categoriaFinanceira(lancamento.tipo)) {
      case "despesa":
        resumo.despesasCentavos += Math.abs(valor);
        break;
      case "pagamento":
        resumo.pagamentosCentavos += Math.abs(valor);
        break;
      case "estorno":
        resumo.estornosCentavos += Math.abs(valor);
        break;
      case "credito":
        resumo.creditosCentavos += Math.abs(valor);
        break;
    }
  }

  return resumo;
}

export type ConferenciaCentavos = {
  saldoCentavos: number;
  totalDeclaradoCentavos: number | null;
  /** totalDeclarado − valor devido calculado. Positivo: fatura declara mais do que a soma encontrada. */
  diferencaCentavos: number | null;
  confere: boolean;
};

/** Tolerância de conferência: 1 centavo (R$ 0,01), conforme a Etapa 3 exige. */
export const TOLERANCIA_CONFERENCIA_CENTAVOS = 1;

/**
 * Confere o saldo líquido calculado contra o total declarado pela fatura.
 * O total declarado é sempre um valor devido (positivo); o saldo líquido
 * interno é negativo quando há dívida — por isso comparamos o total
 * declarado com o módulo do saldo quando ele é negativo.
 *
 * Sem total declarado, não há como confirmar — `confere` fica falso e a
 * diferença fica nula, deixando a divergência explícita em vez de assumir
 * sucesso.
 */
export function conferirFatura(
  saldoCentavos: number,
  totalDeclaradoCentavos: number | null,
): ConferenciaCentavos {
  if (totalDeclaradoCentavos == null) {
    return { saldoCentavos, totalDeclaradoCentavos: null, diferencaCentavos: null, confere: false };
  }
  const devidoCentavos = -saldoCentavos;
  const diferencaCentavos = totalDeclaradoCentavos - devidoCentavos;
  return {
    saldoCentavos,
    totalDeclaradoCentavos,
    diferencaCentavos,
    confere: Math.abs(diferencaCentavos) <= TOLERANCIA_CONFERENCIA_CENTAVOS,
  };
}

export type GrupoSecao = {
  secao: string | null;
  itens: readonly LancamentoImportadoCompleto[];
};

/** Agrupa lançamentos pela seção de origem (evidência de onde foram lidos no documento). */
export function agruparPorSecao(lancamentos: readonly LancamentoImportadoCompleto[]): GrupoSecao[] {
  const mapa = new Map<string | null, LancamentoImportadoCompleto[]>();
  for (const lancamento of lancamentos) {
    const chave = lancamento.evidencia.secao;
    const grupo = mapa.get(chave);
    if (grupo) grupo.push(lancamento);
    else mapa.set(chave, [lancamento]);
  }
  return Array.from(mapa.entries()).map(([secao, itens]) => ({ secao, itens }));
}

export type ConferenciaSecao = {
  secao: string | null;
  somaCentavos: number;
  subtotalDeclaradoCentavos: number | null;
  diferencaCentavos: number | null;
  confere: boolean;
};

/**
 * Confere cada seção/cartão contra os subtotais declarados na fatura.
 *
 * O documento não amarra explicitamente um subtotal a uma seção (o rótulo é
 * texto livre, ex: "Subtotal do cartão"), então o pareamento automático só é
 * seguro quando existe exatamente uma seção e exatamente um subtotal — caso
 * contrário a conferência por seção fica em aberto (`subtotalDeclaradoCentavos:
 * null`) em vez de arriscar um pareamento errado. Isso é deliberado: uma
 * divergência silenciosa é pior do que uma conferência que assume "não sei".
 */
export function conferirSecoes(
  grupos: readonly GrupoSecao[],
  subtotaisCentavos: readonly number[],
): ConferenciaSecao[] {
  const pareamentoSeguro = grupos.length === 1 && subtotaisCentavos.length === 1;

  return grupos.map((grupo) => {
    const somaCentavos = grupo.itens.reduce(
      (soma, item) => soma + Math.abs(item.valorNormalizadoCentavos ?? 0),
      0,
    );
    if (!pareamentoSeguro) {
      return {
        secao: grupo.secao,
        somaCentavos,
        subtotalDeclaradoCentavos: null,
        diferencaCentavos: null,
        confere: false,
      };
    }
    const subtotalDeclaradoCentavos = subtotaisCentavos[0] ?? null;
    const diferencaCentavos =
      subtotalDeclaradoCentavos == null ? null : subtotalDeclaradoCentavos - somaCentavos;
    return {
      secao: grupo.secao,
      somaCentavos,
      subtotalDeclaradoCentavos,
      diferencaCentavos,
      confere:
        diferencaCentavos != null && Math.abs(diferencaCentavos) <= TOLERANCIA_CONFERENCIA_CENTAVOS,
    };
  });
}
