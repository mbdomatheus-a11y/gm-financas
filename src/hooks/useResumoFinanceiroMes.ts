import { useMemo } from "react";
import { useDespesas, useReceitas } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { toBRL } from "@/lib/format";
import { competenciaDe, lancamentosPorCompetencias } from "@/lib/recorrencia";
import type { ResumoFinanceiroContexto } from "@/lib/lancamento-ia";

const TOP_CATEGORIAS = 5;

/**
 * Resumo financeiro do mês atual, calculado a partir dos MESMOS dados que o
 * Dashboard/`VisaoGeralHome` já usam (`useDespesas`/`useReceitas` +
 * `lancamentosPorCompetencias`) — nenhuma conta nova, só agregação pro
 * formato compacto que a IA traduz em texto. Ver
 * `claude/plano-fase2-lancamento-2026-10-02.md` (Frente 1) no projeto
 * Claude.
 */
export function useResumoFinanceiroMes(): {
  resumo: ResumoFinanceiroContexto;
  carregando: boolean;
} {
  const { data: despesas = [], isLoading: carregandoDespesas } = useDespesas();
  const { data: receitas = [], isLoading: carregandoReceitas } = useReceitas();
  const cotacao = useCotacao();

  const resumo = useMemo<ResumoFinanceiroContexto>(() => {
    const competencia = competenciaDe(new Date());

    const parcelasDoMes = lancamentosPorCompetencias(despesas as any[], [competencia]);
    const porCategoria = new Map<string, number>();
    let totalDespesas = 0;
    for (const p of parcelasDoMes as any[]) {
      const valorBRL = toBRL(Number(p.valor) || 0, p.moeda ?? "BRL", cotacao);
      totalDespesas += valorBRL;
      const categoria = (p.despesa?.categoria as string) || "Outros";
      porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + valorBRL);
    }

    const receitasDoMes = (receitas as any[]).filter(
      (r) => competenciaDe(r.data_recebimento) === competencia,
    );
    const totalReceitas = receitasDoMes.reduce(
      (acc, r) => acc + toBRL(Number(r.valor) || 0, r.moeda ?? "BRL", cotacao),
      0,
    );

    const topCategoriasDespesa = [...porCategoria.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CATEGORIAS)
      .map(([categoria, total]) => ({ categoria, total }));

    const saldo = totalReceitas - totalDespesas;

    return {
      competencia,
      totalReceitas,
      totalDespesas,
      saldo,
      taxaPoupancaPct: totalReceitas > 0 ? (saldo / totalReceitas) * 100 : null,
      topCategoriasDespesa,
      numLancamentosDespesa: parcelasDoMes.length,
      numLancamentosReceita: receitasDoMes.length,
    };
  }, [despesas, receitas, cotacao]);

  return { resumo, carregando: carregandoDespesas || carregandoReceitas };
}
