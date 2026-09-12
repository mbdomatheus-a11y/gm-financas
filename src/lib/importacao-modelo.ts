export type TipoLancamentoImportado =
  | "compra"
  | "pagamento"
  | "estorno"
  | "tarifa"
  | "juros"
  | "multa"
  | "imposto"
  | "seguro"
  | "saque"
  | "outro_credito"
  | "indefinido";

export type ConfiancaCampo = "alta" | "media" | "baixa";

export type SinalOriginal = "positivo" | "negativo_prefixo" | "negativo_sufixo" | "parenteses";

export type EvidenciaImportacao = {
  pagina: number | null;
  trecho: string;
  secao: string | null;
};

export type ConfiancaLancamento = {
  data: ConfiancaCampo;
  descricao: ConfiancaCampo;
  valor: ConfiancaCampo;
  tipo: ConfiancaCampo;
  parcela: ConfiancaCampo;
  cartao: ConfiancaCampo;
};

/**
 * Representação de auditoria usada entre a leitura do documento e a confirmação.
 * Valores monetários ficam em centavos; compras são negativas e créditos positivos.
 */
export type LancamentoImportadoCompleto = {
  id: string;
  dataCompra: string | null;
  descricaoOriginal: string;
  descricaoNormalizada: string;
  tipo: TipoLancamentoImportado;
  valorBruto: string;
  valorNormalizadoCentavos: number | null;
  moeda: string;
  sinalOriginal: SinalOriginal;
  parcelaAtual: number | null;
  parcelaTotal: number | null;
  cartaoFinal: string | null;
  titular: string | null;
  evidencia: EvidenciaImportacao;
  confianca: ConfiancaLancamento;
  exigeRevisao: boolean;
};

export type ValorMonetarioLido = {
  centavosAbsolutos: number;
  moeda: "BRL" | "USD" | "OUTRA";
  sinalOriginal: SinalOriginal;
};

const MENOS_UNICODE = /[−–—﹣－]/g;

/** Converte formatos monetários brasileiros sem usar ponto flutuante no cálculo. */
export function lerValorMonetario(raw: string): ValorMonetarioLido | null {
  const texto = raw.trim().replace(MENOS_UNICODE, "-");
  if (!texto) return null;

  const sinalOriginal: SinalOriginal = /^\s*\(/.test(texto) && /\)\s*$/.test(texto)
    ? "parenteses"
    : /-\s*$/.test(texto)
      ? "negativo_sufixo"
      : /-/.test(texto)
        ? "negativo_prefixo"
        : "positivo";

  const moeda: ValorMonetarioLido["moeda"] = /(?:US\$|USD)/i.test(texto)
    ? "USD"
    : /(?:R\$|BRL)/i.test(texto)
      ? "BRL"
      : "OUTRA";

  const numero = texto
    .replace(/[()\-+]/g, "")
    .replace(/(?:R\$|US\$|BRL|USD)/gi, "")
    .replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?$/.test(numero)) return null;

  const ultimaVirgula = numero.lastIndexOf(",");
  const ultimoPonto = numero.lastIndexOf(".");
  const separadorDecimal = Math.max(ultimaVirgula, ultimoPonto);
  let inteiros = numero;
  let decimais = "";

  if (separadorDecimal >= 0 && numero.length - separadorDecimal - 1 <= 2) {
    inteiros = numero.slice(0, separadorDecimal);
    decimais = numero.slice(separadorDecimal + 1);
  }

  const reais = inteiros.replace(/[.,]/g, "");
  if (!/^\d+$/.test(reais) || (decimais && !/^\d{1,2}$/.test(decimais))) return null;

  const centavos = Number.parseInt(reais, 10) * 100 + Number.parseInt(decimais.padEnd(2, "0") || "0", 10);
  if (!Number.isSafeInteger(centavos)) return null;
  return { centavosAbsolutos: centavos, moeda, sinalOriginal };
}

const TERMOS_TIPO: Array<{ tipo: TipoLancamentoImportado; padrao: RegExp }> = [
  { tipo: "pagamento", padrao: /\bpagamento(?:\s+(?:recebido|efetuado))?|d[eé]bito autom[aá]tico de fatura\b/i },
  { tipo: "estorno", padrao: /\bestorno|reembolso|devolu[cç][aã]o|cancelamento\b/i },
  { tipo: "outro_credito", padrao: /\bcashback|cr[eé]dito recebido|ajuste a cr[eé]dito\b/i },
  { tipo: "tarifa", padrao: /\btarifa|anuidade\b/i },
  { tipo: "juros", padrao: /\bjuros\b/i },
  { tipo: "multa", padrao: /\bmulta\b/i },
  { tipo: "imposto", padrao: /\biof|imposto\b/i },
  { tipo: "seguro", padrao: /\bseguro\b/i },
  { tipo: "saque", padrao: /\bsaque\b/i },
];

export function classificarTipoSemantico(texto: string, secao?: string | null): TipoLancamentoImportado {
  const contexto = `${secao ?? ""} ${texto}`;
  for (const regra of TERMOS_TIPO) {
    if (regra.padrao.test(contexto)) return regra.tipo;
  }
  if (/\bcompras?|despesas?|lan[cç]amentos?|parcelamentos?\b/i.test(contexto)) return "compra";
  return "indefinido";
}

/** Aplica a convenção interna: despesas negativas; pagamentos e créditos positivos. */
export function normalizarCentavosPorTipo(
  centavosAbsolutos: number,
  tipo: TipoLancamentoImportado,
): number {
  const credito = tipo === "pagamento" || tipo === "estorno" || tipo === "outro_credito";
  return credito ? Math.abs(centavosAbsolutos) : -Math.abs(centavosAbsolutos);
}

export function extrairParcelaSegura(texto: string): { atual: number; total: number } | null {
  const padroes = [
    /\bparc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:\/|de|d)\s*(\d{1,2})\b/i,
  ];
  for (const padrao of padroes) {
    const match = texto.match(padrao);
    if (!match) continue;
    const atual = Number(match[1]);
    const total = Number(match[2]);
    if (atual > 0 && total > 1 && atual <= total && total <= 99) return { atual, total };
  }
  return null;
}

export function extrairFinalCartaoSeguro(texto: string): string | null {
  const match = texto.match(
    /(?:final|cart[aã]o|com\s+final)\D{0,12}(\d{4})\b|[•*xX]{4}[.\s-]?(\d{4})|\b\d{4}[.]\*{4}[.]\*{4}[.](\d{4})\b/,
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}