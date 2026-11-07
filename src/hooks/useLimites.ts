import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useCotacao } from "@/hooks/useCotacao";
import { useEstruturaCategorias } from "@/hooks/useEstruturaCategorias";
import { useDespesas, useFaturasMes } from "@/hooks/useFinance";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { competenciaDoDia, toBRL } from "@/lib/format";
import { macroDe } from "@/lib/macro-categorias";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

/**
 * Limites de gastos por categoria (07/11/2026). Tabela `limites_gasto`
 * (migration 20261107110000_limites_tags.sql). O limite vale para o grupo
 * (casa) e é comparado com o gasto da competência vigente (ciclo do usuário).
 */

export type LimiteGasto = {
  id: string;
  categoria: string;
  valor_mensal: number;
  alerta_percentual: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type StatusLimite = "ok" | "alerta" | "estourado";

export type UsoLimite = {
  limite: LimiteGasto;
  gasto: number;
  /** Percentual do limite já usado (pode passar de 100). */
  percentual: number;
  /** Quanto ainda cabe no limite (negativo quando estourou). */
  restante: number;
  status: StatusLimite;
};

/** Lançamento mínimo aceito por usoDosLimites (formato de lancamentosPorCompetencias). */
export type LancamentoParaLimite = {
  valor: number | string;
  moeda?: string | null;
  despesa?: { categoria?: string | null; moeda?: string | null } | null;
};

const TABELA = "limites_gasto";

/** Erro de tabela ainda não criada (migration não aplicada). */
export function ehTabelaInexistente(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  const msg = String(e.message ?? "");
  return /does not exist|could not find the table|schema cache/i.test(msg);
}

function normalizar(l: any): LimiteGasto {
  return {
    id: String(l.id),
    categoria: String(l.categoria ?? ""),
    valor_mensal: Number(l.valor_mensal) || 0,
    alerta_percentual: Number(l.alerta_percentual) || 80,
    ativo: l.ativo !== false,
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

function chave(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Função pura: cruza os limites com os lançamentos do ciclo e devolve o uso de cada limite ativo.
 * `lancamentos` já deve estar filtrado pela competência desejada (ex.: saída de
 * lancamentosPorCompetencias + aplicarRegrasFaturaMes). A categoria do lançamento é reduzida à
 * macro com `macros` (nomes legados "Macro - Sub" contam na macro). Valores em USD viram BRL
 * pela `cotacao` informada.
 */
export function usoDosLimites(
  limites: LimiteGasto[],
  lancamentos: LancamentoParaLimite[],
  opcoes: { macros?: Set<string>; cotacao?: number; incluirInativos?: boolean } = {},
): UsoLimite[] {
  const macros = opcoes.macros ?? new Set<string>();
  const cotacao = opcoes.cotacao ?? 1;
  const gastoPorCategoria = new Map<string, number>();
  for (const l of lancamentos) {
    const nome = macroDe(l.despesa?.categoria ?? null, macros);
    const moeda = l.despesa?.moeda ?? l.moeda ?? "BRL";
    const valor = toBRL(Number(l.valor) || 0, moeda, cotacao);
    const k = chave(nome);
    gastoPorCategoria.set(k, (gastoPorCategoria.get(k) ?? 0) + valor);
  }

  return limites
    .filter((l) => opcoes.incluirInativos || l.ativo)
    .map((limite) => {
      const gasto = Math.round((gastoPorCategoria.get(chave(limite.categoria)) ?? 0) * 100) / 100;
      const percentual = limite.valor_mensal > 0 ? (gasto / limite.valor_mensal) * 100 : 0;
      const restante = Math.round((limite.valor_mensal - gasto) * 100) / 100;
      const status: StatusLimite =
        percentual > 100 ? "estourado" : percentual >= limite.alerta_percentual ? "alerta" : "ok";
      return { limite, gasto, percentual, restante, status };
    })
    .sort((a, b) => b.percentual - a.percentual);
}

/** Totais para o resumo do ciclo. */
export function resumoDosLimites(usos: UsoLimite[]) {
  return {
    total: usos.length,
    dentro: usos.filter((u) => u.status === "ok").length,
    alerta: usos.filter((u) => u.status === "alerta").length,
    estourados: usos.filter((u) => u.status === "estourado").length,
    limiteTotal: usos.reduce((s, u) => s + u.limite.valor_mensal, 0),
    gastoTotal: usos.reduce((s, u) => s + u.gasto, 0),
  };
}

export type SalvarLimiteInput = {
  id?: string | undefined;
  categoria: string;
  valor_mensal: number;
  alerta_percentual?: number | undefined;
  ativo?: boolean | undefined;
};

/** Lista os limites, com salvar e excluir. `tabelaPendente` = migration ainda não aplicada. */
export function useLimites() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["limites-gasto"],
    queryFn: async (): Promise<{ limites: LimiteGasto[]; tabelaPendente: boolean }> => {
      const { data, error } = await (supabase as any).from(TABELA).select("*").order("categoria");
      if (error) {
        if (ehTabelaInexistente(error)) return { limites: [], tabelaPendente: true };
        throw error;
      }
      return { limites: (data ?? []).map(normalizar), tabelaPendente: false };
    },
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["limites-gasto"] });

  const salvar = useMutation({
    mutationFn: async (input: SalvarLimiteInput) => {
      const categoria = input.categoria.replace(/\s+/g, " ").trim();
      if (!categoria) throw new Error("Escolha a categoria.");
      if (!(input.valor_mensal > 0)) throw new Error("Informe um valor mensal maior que zero.");
      const alerta = Math.round(input.alerta_percentual ?? 80);
      if (alerta < 1 || alerta > 100) throw new Error("O alerta deve ficar entre 1% e 100%.");
      const linha = {
        categoria,
        valor_mensal: Math.round(input.valor_mensal * 100) / 100,
        alerta_percentual: alerta,
        ativo: input.ativo ?? true,
      };
      const q = input.id
        ? (supabase as any).from(TABELA).update(linha).eq("id", input.id)
        : (supabase as any).from(TABELA).insert(linha);
      const { error } = await q;
      if (error) {
        if (ehTabelaInexistente(error)) throw new Error("Os limites ainda não foram ativados no banco.");
        if (String(error.code) === "23505") throw new Error("Já existe um limite para esta categoria.");
        throw error;
      }
    },
    onSuccess: invalidar,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABELA).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return {
    limites: query.data?.limites ?? [],
    tabelaPendente: query.data?.tabelaPendente ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    salvar,
    excluir,
  };
}

/**
 * Uso dos limites no ciclo vigente (ou na competência informada), com os mesmos cálculos do resto
 * do app: lancamentosPorCompetencias + regras de fatura do mês + filtro por competência do vencimento.
 */
export function useUsoDosLimites(competenciaInformada?: string) {
  const vigente = useCompetenciaVigente();
  const competencia = competenciaInformada ?? vigente;
  const cotacao = useCotacao();
  const { data: despesas = [], isSuccess: despesasProntas } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { macros } = useEstruturaCategorias("despesa");
  const base = useLimites();

  const usos = useMemo(() => {
    const lancamentos = aplicarRegrasFaturaMes(
      lancamentosPorCompetencias(despesas as any[], [competencia]),
      faturasMes as any[],
    ).filter((l) => competenciaDoDia(l.vencimento) === competencia);
    return usoDosLimites(base.limites, lancamentos as any[], { macros, cotacao });
  }, [despesas, faturasMes, competencia, cotacao, macros, base.limites]);

  return {
    ...base,
    competencia,
    usos,
    resumo: resumoDosLimites(usos),
    pronto: despesasProntas && !base.isLoading,
  };
}
