/**
 * Duplicidade na importação de fatura (2026-10-10).
 *
 * `duplicidade.ts` só responde "parece duplicado" para marcar a linha. Aqui o
 * objetivo é outro: listar TODOS os lançamentos parecidos que já existem (ou
 * que vieram em outra fatura da mesma importação), dizendo de onde cada um
 * veio — digitado à mão, importado de outra fatura, despesa fixa, lançado pela
 * IA — para o usuário escolher o que fazer com cada caso.
 *
 * Também guarda como o mesmo estabelecimento foi classificado da última vez,
 * para repetir categoria e tipo (ex.: "Plano Nu Cel 25,00" que o usuário
 * marcou como despesa fixa no mês passado).
 */
import { chaveEstabelecimento } from "@/lib/categorizacao";

export type AcaoDuplicata =
  | "decidir"
  | "substituir"
  | "manter_existente"
  | "novo";

/** Lançamento já salvo no banco (tabela despesas) que pode ser o mesmo da fatura. */
export type DespesaExistente = {
  id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  categoria?: string | null;
  subcategoria?: string | null;
  tipo?: string | null;
  direcao?: string | null;
  origem?: string | null;
  total_parcelas?: number | null;
  cartao_final?: string | null;
  cartao_id?: string | null;
  fatura_id?: string | null;
  responsavel?: string | null;
  recorrencia_inicio?: string | null;
  estabelecimento_normalizado?: string | null;
  created_at?: string | null;
};

export type LancamentoImportado = {
  id: string;
  descricao: string;
  valor: number;
  data_compra: string;
  parcela_numero: number;
  parcela_total: number;
  cartao_final: string | null;
  direcao: string;
};

export type Candidata = {
  despesa: DespesaExistente;
  /** Quanto o candidato se parece com o lançamento (0 a 100). */
  score: number;
  motivos: string[];
  diferencaValor: number;
  diasDeDiferenca: number;
};

const DIAS = 86400000;

function dias(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`).getTime();
  const d2 = new Date(`${b}T00:00:00`).getTime();
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 999;
  return Math.round(Math.abs(d1 - d2) / DIAS);
}

/** Primeiras palavras significativas do estabelecimento, para comparar nomes. */
export function nucleoEstabelecimento(descricao: string): string {
  const base = chaveEstabelecimento(descricao)
    .replace(/\b(PAG|PG|IFD|IFOOD|APL|AMZ|MP|PICPAY|MERCPAGO|REDE|CIELO|STONE)\*?\b/g, " ")
    .replace(/[*\/.]/g, " ")
    .replace(/\b\d{1,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.split(" ").slice(0, 3).join(" ");
}

export function rotuloOrigem(d: DespesaExistente): string {
  if (d.tipo === "fixa" || d.recorrencia_inicio) return "Despesa fixa";
  switch (d.origem) {
    case "importacao":
      return "Importado de fatura";
    case "importacao_substituicao":
      return "Importado (substituiu uma fixa)";
    case "importacao_vinculo":
      return "Importado (vinculado a uma fixa)";
    case "fatura_total_concluida":
      return "Total da fatura lançado por você";
    case "ia":
    case "lancamento_ia":
      return "Lançado com a IA";
    case "manual":
      return "Digitado à mão";
    default:
      return d.origem ? `Origem: ${d.origem}` : "Origem não informada";
  }
}

/**
 * Procura, entre os lançamentos já salvos, os que podem ser o mesmo gasto.
 * Exige valor igual (até 1 centavo) ou muito próximo e alguma pista a mais:
 * mesmo estabelecimento, mesma data ou data vizinha, mesmo final de cartão.
 */
export function encontrarCandidatas(
  l: LancamentoImportado,
  existentes: DespesaExistente[],
  opcoes: { janelaDias?: number } = {},
): Candidata[] {
  const janela = opcoes.janelaDias ?? 7;
  const valorTotal = Number((l.valor * Math.max(1, l.parcela_total)).toFixed(2));
  const nucleo = nucleoEstabelecimento(l.descricao);
  const saida: Candidata[] = [];

  for (const d of existentes) {
    if (d.direcao && l.direcao && d.direcao !== l.direcao) continue;
    const valorExistente = Number(d.valor_total ?? 0);
    if (!valorExistente) continue;

    // Compara tanto com o valor da parcela quanto com o valor total do
    // parcelamento: o mesmo gasto pode ter sido digitado de um jeito ou de outro.
    const difParcela = Math.abs(valorExistente - l.valor);
    const difTotal = Math.abs(valorExistente - valorTotal);
    const diferencaValor = Math.min(difParcela, difTotal);
    const tolerancia = Math.max(0.01, l.valor * 0.02);
    if (diferencaValor > tolerancia) continue;

    const distancia = dias(d.data_compra, l.data_compra);
    const nucleoExistente = nucleoEstabelecimento(d.descricao);
    const mesmoNome =
      !!nucleo &&
      !!nucleoExistente &&
      (nucleo === nucleoExistente ||
        nucleo.startsWith(nucleoExistente) ||
        nucleoExistente.startsWith(nucleo));
    const mesmoFinal = !!l.cartao_final && d.cartao_final === l.cartao_final;

    if (!mesmoNome && distancia > janela) continue;
    if (!mesmoNome && !mesmoFinal) continue;

    const motivos: string[] = [];
    motivos.push(diferencaValor <= 0.01 ? "mesmo valor" : "valor quase igual (até 2%)");
    if (mesmoNome) motivos.push("mesmo estabelecimento");
    if (distancia === 0) motivos.push("mesma data");
    else if (distancia <= janela) motivos.push(`${distancia} dia(s) de diferença`);
    if (mesmoFinal) motivos.push(`mesmo cartão final ${l.cartao_final}`);

    const score =
      (diferencaValor <= 0.01 ? 45 : 30) +
      (mesmoNome ? 30 : 0) +
      (distancia === 0 ? 20 : distancia <= janela ? 10 : 0) +
      (mesmoFinal ? 5 : 0);

    saida.push({ despesa: d, score, motivos, diferencaValor, diasDeDiferenca: distancia });
  }

  return saida.sort((a, b) => b.score - a.score || a.diasDeDiferenca - b.diasDeDiferenca);
}

export type ClassificacaoAnterior = {
  categoria: string;
  subcategoria: string | null;
  tipo: "fixa" | "variavel";
  descricaoModelo: string;
  valorModelo: number;
  dataModelo: string;
};

/**
 * Como o mesmo estabelecimento foi classificado da última vez. Usa o lançamento
 * mais recente com nome equivalente; se algum deles tiver valor parecido,
 * prefere esse (ex.: "Plano Nu Cel" de 25,00 marcado como fixa).
 */
export function classificacaoAnterior(
  l: Pick<LancamentoImportado, "descricao" | "valor">,
  existentes: DespesaExistente[],
): ClassificacaoAnterior | null {
  const nucleo = nucleoEstabelecimento(l.descricao);
  if (!nucleo) return null;
  const mesmos = existentes.filter((d) => {
    const n = nucleoEstabelecimento(d.descricao);
    return !!n && (n === nucleo || n.startsWith(nucleo) || nucleo.startsWith(n));
  });
  if (!mesmos.length) return null;

  const recente = (lista: DespesaExistente[]) =>
    [...lista].sort((a, b) => (b.data_compra ?? "").localeCompare(a.data_compra ?? ""))[0]!;
  const valorParecido = mesmos.filter(
    (d) => Math.abs(Number(d.valor_total ?? 0) - l.valor) <= Math.max(0.01, l.valor * 0.05),
  );
  const modelo = recente(valorParecido.length ? valorParecido : mesmos);
  if (!modelo.categoria) return null;
  return {
    categoria: modelo.categoria,
    subcategoria: modelo.subcategoria ?? null,
    tipo: modelo.tipo === "fixa" || modelo.recorrencia_inicio ? "fixa" : "variavel",
    descricaoModelo: modelo.descricao,
    valorModelo: Number(modelo.valor_total ?? 0),
    dataModelo: modelo.data_compra,
  };
}
