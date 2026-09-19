import { monthKey } from "@/lib/format";

export type Periodicidade = "mensal" | "semestral" | "anual";

/** Horizonte padrão (em meses) para materializar ocorrências de uma recorrência sem prazo. */
export const HORIZONTE_SEM_PRAZO = 36;

export const PERIODICIDADES: { value: Periodicidade; label: string; meses: number }[] = [
  { value: "mensal", label: "Mensal", meses: 1 },
  { value: "semestral", label: "Semestral", meses: 6 },
  { value: "anual", label: "Anual", meses: 12 },
];

export function mesesDaPeriodicidade(p: Periodicidade): number {
  return p === "mensal" ? 1 : p === "semestral" ? 6 : 12;
}

/** "percentual": reajuste composto (%); "fixo": incremento fixo em R$ a cada aplicação. */
export type ModoReajuste = "percentual" | "fixo";

export interface ReajusteConfig {
  /** Padrão "percentual" quando ausente, para compatibilidade com dados existentes. */
  modo?: ModoReajuste;
  percentual: number;
  /** Usado somente quando modo === "fixo": incremento em R$ aplicado a cada período. */
  valorFixo?: number;
  periodicidade: Periodicidade;
  /** Competência (ou data) do primeiro reajuste. Sem valor, usa o mês seguinte ao início. */
  inicio?: string | null;
  indice?: string | null;
}

/** Verifica se a configuração de reajuste realmente produz algum efeito. */
function reajusteAtivo(cfg: ReajusteConfig | null | undefined): boolean {
  if (!cfg) return false;
  if (cfg.modo === "fixo") return Number.isFinite(cfg.valorFixo) && cfg.valorFixo !== 0;
  return Number.isFinite(cfg.percentual) && cfg.percentual !== 0;
}

export interface RecorrenciaFixa {
  /** Valor mensal inicial, na competência de início. */
  valor: number;
  /** Data (ou competência) em que a recorrência começa. */
  inicio: string;
  semPrazo: boolean;
  /** Quantidade de competências quando há prazo determinado. */
  meses?: number | null;
  reajuste?: ReajusteConfig | null;
}

/** Normaliza uma data ISO ou competência "AAAA-MM" para a chave de competência. */
export function competenciaDe(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) return value;
  return monthKey(value);
}

/** Diferença em meses entre duas competências (b - a). */
export function mesesEntreCompetencias(a: string, b: string): number {
  const [ay, am] = competenciaDe(a).split("-").map(Number);
  const [by, bm] = competenciaDe(b).split("-").map(Number);
  return (by! - ay!) * 12 + (bm! - am!);
}

export function somarMeses(competencia: string, n: number): string {
  const [y, m] = competenciaDe(competencia).split("-").map(Number);
  const total = y! * 12 + (m! - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = total % 12;
  return `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

/** Arredonda para centavos evitando erro de ponto flutuante. */
function paraCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

/** Quantas vezes o reajuste já foi aplicado até a competência informada. */
export function aplicacoesDeReajuste(r: RecorrenciaFixa, competencia: string): number {
  const cfg = r.reajuste;
  if (!cfg || !reajusteAtivo(cfg)) return 0;
  const inicioReajuste = cfg.inicio
    ? competenciaDe(cfg.inicio)
    : somarMeses(competenciaDe(r.inicio), mesesDaPeriodicidade(cfg.periodicidade));
  const diff = mesesEntreCompetencias(inicioReajuste, competenciaDe(competencia));
  if (diff < 0) return 0;
  return Math.floor(diff / mesesDaPeriodicidade(cfg.periodicidade)) + 1;
}

/** Índice da competência dentro da recorrência (0 = primeira); -1 quando fora. */
export function ordemDaCompetencia(r: RecorrenciaFixa, competencia: string): number {
  const diff = mesesEntreCompetencias(r.inicio, competencia);
  if (diff < 0) return -1;
  if (!r.semPrazo && r.meses && diff >= r.meses) return -1;
  return diff;
}

export function ativaNaCompetencia(r: RecorrenciaFixa, competencia: string): boolean {
  return ordemDaCompetencia(r, competencia) >= 0;
}

/**
 * Valor vigente da recorrência na competência informada, com reajuste composto
 * sempre aplicado sobre o último valor reajustado. Retorna null fora do período.
 */
export function valorNaCompetencia(r: RecorrenciaFixa, competencia: string): number | null {
  if (!ativaNaCompetencia(r, competencia)) return null;
  let cents = paraCentavos(r.valor);
  const n = aplicacoesDeReajuste(r, competencia);
  if (r.reajuste?.modo === "fixo") {
    cents += paraCentavos(r.reajuste.valorFixo ?? 0) * n;
  } else {
    const fator = 1 + (r.reajuste?.percentual ?? 0) / 100;
    for (let i = 0; i < n; i++) cents = Math.round(cents * fator);
  }
  return cents / 100;
}

export interface CompetenciaProjetada {
  competencia: string;
  valor: number;
  ordem: number;
  /** Total de competências quando há prazo determinado. */
  total: number | null;
}

/** Projeta as competências da recorrência dentro de um intervalo (inclusive). */
export function projetarCompetencias(
  r: RecorrenciaFixa,
  de: string,
  ate: string,
): CompetenciaProjetada[] {
  const inicio = competenciaDe(r.inicio);
  const primeira = mesesEntreCompetencias(de, inicio) > 0 ? inicio : competenciaDe(de);
  const ultimaPorPrazo = !r.semPrazo && r.meses ? somarMeses(inicio, r.meses - 1) : null;
  const limite =
    ultimaPorPrazo && mesesEntreCompetencias(ultimaPorPrazo, competenciaDe(ate)) > 0
      ? ultimaPorPrazo
      : competenciaDe(ate);
  const qtd = mesesEntreCompetencias(primeira, limite);
  const out: CompetenciaProjetada[] = [];
  for (let i = 0; i <= qtd; i++) {
    const competencia = somarMeses(primeira, i);
    const valor = valorNaCompetencia(r, competencia);
    if (valor == null) continue;
    out.push({
      competencia,
      valor,
      ordem: ordemDaCompetencia(r, competencia),
      total: r.semPrazo ? null : (r.meses ?? null),
    });
  }
  return out;
}

/** Lê a recorrência a partir de uma linha de `despesas`. */
export function recorrenciaDaDespesa(d: any): RecorrenciaFixa | null {
  if ((d?.tipo ?? "") !== "fixa") return null;
  const valor = Number(d.valor_total) || 0;
  const inicio = d.recorrencia_inicio ?? d.data_primeira_parcela ?? d.data_compra;
  if (!inicio) return null;
  const semPrazo = d.recorrencia_sem_prazo !== false && !d.recorrencia_meses;
  const percentual = Number(d.reajuste_percentual);
  return {
    valor,
    inicio,
    semPrazo,
    meses: d.recorrencia_meses ?? null,
    reajuste:
      Number.isFinite(percentual) && percentual !== 0 && d.reajuste_periodicidade
        ? {
            percentual,
            periodicidade: d.reajuste_periodicidade as Periodicidade,
            inicio: d.reajuste_inicio ?? null,
            indice: d.reajuste_indice ?? null,
          }
        : null,
  };
}

/** Lê a recorrência a partir de uma linha de `receitas` (mensal recorrente, sem prazo). */
export function recorrenciaDaReceita(r: any): RecorrenciaFixa | null {
  const valor = Number(r.valor) || 0;
  const inicio = r.recorrencia_inicio ?? r.data_recebimento;
  if (!inicio) return null;
  const semPrazo = r.recorrencia_sem_prazo !== false && !r.recorrencia_meses;
  const modo: ModoReajuste = r.reajuste_modo === "fixo" ? "fixo" : "percentual";
  const percentual = Number(r.reajuste_percentual);
  const valorFixo = Number(r.reajuste_valor_fixo);
  const ativo =
    !!r.reajuste_periodicidade &&
    (modo === "fixo"
      ? Number.isFinite(valorFixo) && valorFixo !== 0
      : Number.isFinite(percentual) && percentual !== 0);
  return {
    valor,
    inicio,
    semPrazo,
    meses: r.recorrencia_meses ?? null,
    reajuste: ativo
      ? {
          modo,
          percentual: modo === "percentual" ? percentual : 0,
          valorFixo: modo === "fixo" ? valorFixo : 0,
          periodicidade: r.reajuste_periodicidade as Periodicidade,
          inicio: r.reajuste_inicio ?? null,
          indice: r.reajuste_indice ?? null,
        }
      : null,
  };
}

export interface LancamentoCompetencia {
  id: string;
  despesa_id: string;
  numero: number;
  total: number;
  valor: number;
  moeda: string;
  vencimento: string;
  paga: boolean;
  data_pagamento: string | null;
  competencia: string;
  projetada: boolean;
  despesa: any;
}

export function vencimentoDaCompetencia(inicio: string, competencia: string): string {
  const dia = Math.min(28, Number(inicio.slice(8, 10)) || 1);
  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

/**
 * Monta uma única ocorrência por despesa e competência. Recorrências novas são
 * calculadas pela regra; parcelas persistidas servem apenas para recuperar o pagamento.
 * Despesas variáveis e fixas legadas continuam usando suas parcelas existentes.
 */
export function lancamentosPorCompetencias(
  despesas: any[],
  competencias: string[],
): LancamentoCompetencia[] {
  const desejadas = new Set(competencias.map(competenciaDe));
  const out: LancamentoCompetencia[] = [];

  for (const despesa of despesas) {
    const parcelas = (despesa.parcelas ?? []) as any[];
    const recorrencia = despesa.recorrencia_inicio ? recorrenciaDaDespesa(despesa) : null;

    if (!recorrencia) {
      for (const parcela of parcelas) {
        const competencia = competenciaDe(parcela.vencimento);
        if (!desejadas.has(competencia)) continue;
        out.push({
          ...parcela,
          id: String(parcela.id),
          despesa_id: String(parcela.despesa_id ?? despesa.id),
          valor: Number(parcela.valor),
          moeda: parcela.moeda ?? despesa.moeda,
          paga: Boolean(parcela.paga),
          data_pagamento: parcela.data_pagamento ?? null,
          competencia,
          projetada: false,
          despesa,
        });
      }
      continue;
    }

    const existentes = new Map(
      parcelas.map((parcela) => [competenciaDe(parcela.vencimento), parcela] as const),
    );
    for (const competencia of desejadas) {
      const valor = valorNaCompetencia(recorrencia, competencia);
      if (valor == null) continue;
      const existente = existentes.get(competencia);
      const ordem = ordemDaCompetencia(recorrencia, competencia);
      out.push({
        id: existente?.id ?? `rec:${despesa.id}:${competencia}`,
        despesa_id: String(despesa.id),
        numero: ordem + 1,
        total: recorrencia.semPrazo ? 0 : (recorrencia.meses ?? 0),
        valor: existente?.origem === "importacao_substituicao"
          ? Number(existente.valor)
          : valor,
        moeda: despesa.moeda,
        vencimento:
          existente?.vencimento ?? vencimentoDaCompetencia(recorrencia.inicio, competencia),
        paga: Boolean(existente?.paga),
        data_pagamento: existente?.data_pagamento ?? null,
        competencia,
        projetada: !existente,
        despesa,
      });
    }
  }

  return out;
}
