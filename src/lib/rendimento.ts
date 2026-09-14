/**
 * Motor de projeção de rendimento de investimentos — análogo ao
 * `recorrencia.ts` (despesas/receitas), mas para investimentos indexados a
 * CDI, Selic, IPCA+ ou taxa fixa. Pura e síncrona: a busca da taxa-base no
 * Banco Central acontece fora daqui (em `indices.functions.ts`) e o
 * resultado é passado como `taxaAnualBase`.
 */

export type TipoRendimento = "cdi" | "selic" | "ipca_mais" | "fixo";

export const TIPOS_RENDIMENTO: {
  value: TipoRendimento;
  label: string;
  sufixoPercentual: string;
}[] = [
  { value: "cdi", label: "% do CDI (automático)", sufixoPercentual: "% do CDI" },
  { value: "selic", label: "% da Selic (automático)", sufixoPercentual: "% da Selic" },
  {
    value: "ipca_mais",
    label: "IPCA + spread fixo",
    sufixoPercentual: "% a.a. de spread sobre o IPCA",
  },
  { value: "fixo", label: "Taxa fixa (manual)", sufixoPercentual: "% a.a." },
];

export interface ConfigRendimento {
  tipo: TipoRendimento;
  /**
   * CDI/Selic: percentual do indexador (ex.: 110 = 110% do CDI).
   * IPCA+: spread em % a.a. somado ao IPCA acumulado 12 meses.
   * Fixo: taxa cheia em % a.a., informada manualmente.
   */
  percentual: number;
}

/** Converte uma taxa anual (% a.a.) em taxa mensal equivalente, por juros compostos. */
export function taxaAnualParaMensal(taxaAnual: number): number {
  return (Math.pow(1 + taxaAnual / 100, 1 / 12) - 1) * 100;
}

/**
 * Taxa mensal efetiva do investimento, combinando a configuração do usuário
 * com a taxa anual "base" do indexador (CDI, Selic ou IPCA 12m — já
 * buscada no Bacen). `taxaAnualBase` é ignorado quando `tipo === "fixo"`.
 */
export function taxaMensalEfetiva(cfg: ConfigRendimento, taxaAnualBase: number | null): number {
  switch (cfg.tipo) {
    case "cdi":
    case "selic": {
      const base = taxaAnualBase ?? 0;
      const taxaAnualEfetiva = base * (cfg.percentual / 100);
      return taxaAnualParaMensal(taxaAnualEfetiva);
    }
    case "ipca_mais": {
      const base = taxaAnualBase ?? 0;
      const taxaAnualEfetiva = ((1 + base / 100) * (1 + cfg.percentual / 100) - 1) * 100;
      return taxaAnualParaMensal(taxaAnualEfetiva);
    }
    case "fixo":
      return taxaAnualParaMensal(cfg.percentual);
    default:
      return 0;
  }
}

export interface ProjecaoMes {
  mes: number;
  valor: number;
}

/**
 * Projeta o valor de um investimento mês a mês, compondo a taxa mensal
 * efetiva sobre o valor atual. Assume a taxa-base constante ao longo da
 * projeção (a taxa futura real do CDI/Selic/IPCA não é previsível — manter a
 * taxa vigente é a convenção padrão usada por corretoras e apps do gênero).
 */
export function projetarRendimento(
  valorAtual: number,
  cfg: ConfigRendimento,
  taxaAnualBase: number | null,
  meses: number,
): ProjecaoMes[] {
  const taxaMensal = taxaMensalEfetiva(cfg, taxaAnualBase) / 100;
  const out: ProjecaoMes[] = [];
  let valor = valorAtual;
  for (let m = 1; m <= meses; m++) {
    valor = valor * (1 + taxaMensal);
    out.push({ mes: m, valor: Math.round(valor * 100) / 100 });
  }
  return out;
}
