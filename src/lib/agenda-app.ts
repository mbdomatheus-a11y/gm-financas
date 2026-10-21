import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ponteNativa } from "@/lib/app-nativo";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { formatBRL, monthKey, toBRL, toISODate } from "@/lib/format";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

/**
 * Eventos do calendário do site (faturas, notas, garantias e lista de compras) e a
 * sincronização com a agenda do iPhone. Usado pela tela Calendário e pela sincronização
 * automática do app (SincronizadorAgendaApp).
 */
export type Tipo = "fatura" | "nota" | "garantia" | "lista";

export type Evento = {
  id: string;
  tipo: Tipo;
  data: string; // YYYY-MM-DD
  titulo: string;
  valor?: number | undefined;
  detalhe?: string | undefined;
  ref?: any;
};

export type DadosAgenda = {
  despesas: unknown[];
  faturasMes: unknown[];
  cartoes: unknown[];
  notas: unknown[];
  listaItens: unknown[];
  cotacao: Parameters<typeof toBRL>[2];
};

export function ultimoDiaDoMes(chave: string): number {
  const [a, m] = chave.split("-").map(Number);
  return new Date(a!, m!, 0).getDate();
}

export function somarMes(chave: string, delta: number): string {
  const [a, m] = chave.split("-").map(Number);
  return monthKey(new Date(a!, m! - 1 + delta, 1));
}

export function useNotasAgenda() {
  return useQuery({
    queryKey: ["calendario-notas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("id,estabelecimento,descricao,data_compra,garantia_fim,valor_total");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useListaAgenda() {
  return useQuery({
    queryKey: ["calendario-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("id,nome,quantidade,valor_estimado,alerta_em,updated_at,comprado,aprovacoes_necessarias,aprovado_por");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Eventos de um mês (YYYY-MM) do calendário do site. */
export function gerarEventosMes(mes: string, dados: DadosAgenda): Evento[] {
  const { despesas, faturasMes, cartoes, notas, listaItens, cotacao } = dados;
  const out: Evento[] = [];
  // Faturas do mês: soma por cartão, vencendo no dia de vencimento do cartão.
  const lanc = aplicarRegrasFaturaMes(
    lancamentosPorCompetencias(despesas as any[], [mes]),
    faturasMes as any[],
  );
  const porCartao = new Map<string, any[]>();
  for (const l of lanc as any[]) {
    const cid = l.despesa?.cartao_id;
    if (!cid) continue;
    if (!porCartao.has(cid)) porCartao.set(cid, []);
    porCartao.get(cid)!.push(l);
  }
  for (const [cid, itens] of porCartao) {
    const c = (cartoes as any[]).find((x) => x.id === cid);
    if (!c) continue;
    const dia = Math.min(Number(c.dia_vencimento) || 10, ultimoDiaDoMes(mes));
    const total = itens.reduce(
      (t, l) => t + toBRL(Number(l.valor), l.moeda ?? l.despesa?.moeda ?? "BRL", cotacao),
      0,
    );
    const paga = itens.every((l) => l.paga);
    out.push({
      id: `fatura:${cid}:${mes}`,
      tipo: "fatura",
      data: `${mes}-${String(dia).padStart(2, "0")}`,
      titulo: `Fatura ${c.apelido || c.titular || "cartão"}${c.final ? ` •${c.final}` : ""}`,
      valor: total,
      detalhe: `${itens.length} lançamento(s)${paga ? " · paga" : ""}`,
      ref: { cartao: c, itens },
    });
  }
  for (const n of notas as any[]) {
    if (n.data_compra && n.data_compra.slice(0, 7) === mes) {
      out.push({
        id: `nota:${n.id}`,
        tipo: "nota",
        data: n.data_compra,
        titulo: `Nota: ${n.estabelecimento || n.descricao || "compra"}`,
        valor: Number(n.valor_total) || 0,
        ref: n,
      });
    }
    if (n.garantia_fim && n.garantia_fim.slice(0, 7) === mes) {
      out.push({
        id: `garantia:${n.id}`,
        tipo: "garantia",
        data: n.garantia_fim,
        titulo: `Garantia termina: ${n.estabelecimento || n.descricao || "compra"}`,
        valor: Number(n.valor_total) || 0,
        ref: n,
      });
    }
  }
  for (const it of listaItens as any[]) {
    const nec = Number(it.aprovacoes_necessarias) || 0;
    const aprov = (it.aprovado_por ?? []).length;
    if (it.comprado || nec <= 0 || aprov < nec) continue;
    const data = it.alerta_em || String(it.updated_at ?? "").slice(0, 10);
    if (!data || data.slice(0, 7) !== mes) continue;
    out.push({
      id: `lista:${it.id}`,
      tipo: "lista",
      data,
      titulo: `Aprovado: ${it.nome}${it.quantidade > 1 ? ` (x${it.quantidade})` : ""}`,
      valor: it.valor_estimado != null ? Number(it.valor_estimado) : undefined,
      detalhe: "Item aprovado da lista de compras",
      ref: it,
    });
  }
  return out;
}

/**
 * Eventos futuros dos próximos 12 meses que vão para a agenda do iPhone:
 * faturas em aberto, fim de garantias e itens aprovados da lista de compras.
 */
export function eventosParaAgendaApp(dados: DadosAgenda) {
  const hojeISO = toISODate(new Date());
  const atual = monthKey(new Date());
  return Array.from({ length: 12 }, (_, i) => gerarEventosMes(somarMes(atual, i), dados))
    .flat()
    .filter((e) => e.data >= hojeISO)
    .filter(
      (e) =>
        e.tipo === "garantia" ||
        e.tipo === "lista" ||
        (e.tipo === "fatura" && !((e.ref?.itens ?? []) as { paga?: boolean }[]).every((l) => l.paga)),
    )
    .map((e) => ({
      id: e.id,
      titulo: e.valor ? `${e.titulo} · ${formatBRL(e.valor)}` : e.titulo,
      data: e.data,
      notas: [e.detalhe, "Lançado pelo Control ALL"].filter(Boolean).join(" · "),
    }));
}

/** A agenda do iPhone já está vinculada (permissão dada e calendário criado)? */
export function agendaAppVinculada(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { __controlAllApp?: { agendaVinculada?: boolean } }).__controlAllApp?.agendaVinculada;
}

/** Envia os eventos ao app. `silencioso`: sincronização automática, sem aviso na tela. */
export function enviarParaAgendaApp(eventos: ReturnType<typeof eventosParaAgendaApp>, silencioso = false): boolean {
  const ponte = ponteNativa("agendaApp");
  if (!ponte) return false;
  ponte.postMessage({ eventos, silencioso });
  return true;
}
