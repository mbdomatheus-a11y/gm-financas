import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { competenciaDoDia, toBRL } from "@/lib/format";
import { contaComoDespesa } from "@/lib/regras-saldo";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

export type FiltroCardMes = "parcelas" | "aberto";
export type LancamentoCard = { despesa: any; parcela: any; valor: number };

/**
 * 08/11/2026: lançamentos que compõem "Parcelas do mês" e "Dívida em aberto do mês" do dashboard.
 * Uma só função: o card soma esta lista e a tela Despesas (?filtro=&mes=) mostra exatamente ela.
 */
export function lancamentosDoCardMes(
  despesas: any[],
  faturas: any[],
  mes: string,
  filtro: FiltroCardMes,
  cotacao: number,
  somarPagamentoFatura: boolean,
): LancamentoCard[] {
  return aplicarRegrasFaturaMes(lancamentosPorCompetencias(despesas, [mes]), faturas)
    .filter((p: any) => contaComoDespesa(p.despesa, somarPagamentoFatura))
    .filter((p: any) => competenciaDoDia(p.vencimento) === mes && (filtro === "parcelas" || !p.paga))
    .map((p: any) => ({ despesa: p.despesa, parcela: p, valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao) }))
    .sort((a, b) => String(a.parcela.vencimento).localeCompare(String(b.parcela.vencimento)));
}

export function somaLancamentosCard(itens: LancamentoCard[]): number {
  return itens.reduce((s, i) => s + i.valor, 0);
}
