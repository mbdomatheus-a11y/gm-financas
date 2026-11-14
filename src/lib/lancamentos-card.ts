import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { diaViradaDefinida, toBRL } from "@/lib/format";
import { despesaNoCiclo, janelasDoCiclo } from "@/lib/numeros-ciclo";
import { contaComoDespesa } from "@/lib/regras-saldo";
import { lancamentosPorCompetencias, somarMeses } from "@/lib/recorrencia";

export type FiltroCardMes = "parcelas" | "aberto";
export type LancamentoCard = { despesa: any; parcela: any; valor: number };

/**
 * 08/11/2026: lançamentos que compõem "Parcelas do mês" e "Dívida em aberto do mês" do dashboard.
 * Uma só função: o card soma esta lista e a tela Despesas (?filtro=&mes=) mostra exatamente ela.
 * 09/11/2026: mesma janela do ciclo (numeros-ciclo.ts): contas que vencem e faturas que fecham no mês M+1.
 */
export function lancamentosDoCardMes(
  despesas: any[],
  faturas: any[],
  mes: string,
  filtro: FiltroCardMes,
  cotacao: number,
  somarPagamentoFatura: boolean,
  cartoes?: any[] | null,
  diaVirada: number | null = diaViradaDefinida(),
  tipo?: "fixa" | "variavel",
): LancamentoCard[] {
  const j = janelasDoCiclo(mes, diaVirada);
  const comps = [-1, 0, 1, 2].map((i) => somarMeses(mes, i));
  return aplicarRegrasFaturaMes(lancamentosPorCompetencias(despesas, comps), faturas)
    .filter((p: any) => contaComoDespesa(p.despesa, somarPagamentoFatura))
    .filter((p: any) => despesaNoCiclo(p, j, cartoes) && (filtro === "parcelas" || !p.paga))
    .filter((p: any) => !tipo || (tipo === "fixa") === (p.despesa.tipo === "fixa"))
    .map((p: any) => ({ despesa: p.despesa, parcela: p, valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao) }))
    .sort((a, b) => String(a.parcela.vencimento).localeCompare(String(b.parcela.vencimento)));
}

export function somaLancamentosCard(itens: LancamentoCard[]): number {
  return itens.reduce((s, i) => s + i.valor, 0);
}
