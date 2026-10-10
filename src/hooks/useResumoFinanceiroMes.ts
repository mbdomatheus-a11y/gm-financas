import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDespesas, useReceitas } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { monthKey, toBRL } from "@/lib/format";
import { competenciaDe, lancamentosPorCompetencias } from "@/lib/recorrencia";
import type { ResumoFinanceiroContexto } from "@/lib/lancamento-ia";
import { supabase } from "@/integrations/supabase/client";

const TOP_CATEGORIAS = 5;

/**
 * Resumo financeiro enriquecido para o módulo de IA responder perguntas abertas
 * sobre finanças, parcelamentos que terminam, assinaturas, lista de compras e notas fiscais.
 */
export function useResumoFinanceiroMes(): {
  resumo: ResumoFinanceiroContexto;
  carregando: boolean;
} {
  const { data: despesas = [], isLoading: carregandoDespesas } = useDespesas();
  const { data: receitas = [], isLoading: carregandoReceitas } = useReceitas();
  const cotacao = useCotacao();

  const { data: compras = [] } = useQuery({
    queryKey: ["resumo-ia-lista-compras"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lista_compras")
        .select("nome,quantidade,categoria,comprado")
        .order("comprado")
        .limit(60);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: notas = [] } = useQuery({
    queryKey: ["resumo-ia-notas-fiscais"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notas_fiscais")
        .select("descricao,emitente,valor_total,data_compra,garantia_ate")
        .order("created_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
    staleTime: 60_000,
  });

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

    const emAberto = (parcelasDoMes as any[]).filter((p) => !p.paga);
    const lancamentosEmAberto = {
      quantidade: emAberto.length,
      total: emAberto.reduce(
        (t, p) => t + toBRL(Number(p.valor) || 0, p.moeda ?? p.despesa?.moeda ?? "BRL", cotacao),
        0,
      ),
    };

    // Média dos 3 meses anteriores por categoria (base para "acima do normal").
    const [anoAtual, mesAtual] = competencia.split("-").map(Number);
    const anteriores = [1, 2, 3].map((i) => competenciaDe(new Date(anoAtual!, mesAtual! - 1 - i, 1)));
    const somaAnt = new Map<string, number>();
    for (const c of anteriores) {
      for (const p of lancamentosPorCompetencias(despesas as any[], [c]) as any[]) {
        const cat = (p.despesa?.categoria as string) || "Outros";
        somaAnt.set(
          cat,
          (somaAnt.get(cat) ?? 0) + toBRL(Number(p.valor) || 0, p.moeda ?? "BRL", cotacao),
        );
      }
    }
    const mediaCategoriasAnteriores = [...somaAnt.entries()].map(([categoria, t]) => ({
      categoria,
      media: t / 3,
    }));

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

    // Parcelamentos que terminam no futuro
    const parcelamentosFuturos: ResumoFinanceiroContexto["parcelamentosFuturos"] = [];
    for (const d of despesas as any[]) {
      if (d.tipo === "fixa" || !d.parcelas?.length) continue;
      const naoPagas = (d.parcelas as any[]).filter((p) => !p.paga);
      if (!naoPagas.length) continue;
      const ultima = naoPagas.reduce((m, p) => (p.vencimento > m.vencimento ? p : m));
      const mesFim = monthKey(ultima.vencimento);
      const valorParcela = toBRL(Number(ultima.valor ?? d.valor_parcela ?? d.valor), d.moeda, cotacao);
      parcelamentosFuturos.push({
        descricao: d.descricao,
        mesFim,
        valorParcela,
        parcelasRestantes: naoPagas.length,
        totalParcelas: d.total_parcelas,
      });
    }

    // Gastos fixos e assinaturas recorrentes
    const gastosFixosRecorrentes: ResumoFinanceiroContexto["gastosFixosRecorrentes"] = [];
    for (const d of despesas as any[]) {
      if (d.tipo === "fixa" || d.recorrente) {
        gastosFixosRecorrentes.push({
          descricao: d.descricao,
          valor: toBRL(Number(d.valor_total ?? d.valor), d.moeda, cotacao),
          categoria: d.categoria ?? "Fixa",
        });
      }
    }

    const itensListaCompras = (compras as any[]).map((c) => ({
      nome: c.nome,
      quantidade: c.quantidade ?? 1,
      categoria: c.categoria ?? "geral",
      comprado: Boolean(c.comprado),
    }));

    const notasFiscais = (notas as any[]).map((n) => ({
      descricao: n.descricao,
      emitente: n.emitente ?? null,
      valor: n.valor_total ? Number(n.valor_total) : null,
      dataCompra: n.data_compra ?? null,
      garantiaAte: n.garantia_ate ?? null,
    }));

    return {
      competencia,
      totalReceitas,
      totalDespesas,
      saldo,
      taxaPoupancaPct: totalReceitas > 0 ? (saldo / totalReceitas) * 100 : null,
      topCategoriasDespesa,
      mediaCategoriasAnteriores,
      lancamentosEmAberto,
      numLancamentosDespesa: parcelasDoMes.length,
      numLancamentosReceita: receitasDoMes.length,
      parcelamentosFuturos,
      gastosFixosRecorrentes,
      itensListaCompras,
      notasFiscais,
    };
  }, [despesas, receitas, compras, notas, cotacao]);

  return { resumo, carregando: carregandoDespesas || carregandoReceitas };
}
