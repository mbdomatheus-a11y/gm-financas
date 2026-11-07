import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { competenciaDoDia, diaViradaDefinida, toBRL } from "@/lib/format";
import { subDe } from "@/lib/macro-categorias";
import { datasDoCiclo } from "@/lib/previsao-mes";
import { lancamentosPorCompetencias, receitasPorCompetencias, somarMeses } from "@/lib/recorrencia";

/**
 * Relatórios (07/11/2026): funções puras que alimentam a tela /relatorios.
 * Usam as MESMAS regras do Dashboard e do "Para onde vai": lancamentosPorCompetencias +
 * aplicarRegrasFaturaMes para despesas (competência pelo dia do vencimento) e
 * receitasPorCompetencias para receitas (com as fixas projetadas). Nada aqui grava dados.
 */

export type ItemDespesa = {
  id: string;
  despesaId: string;
  competencia: string;
  vencimento: string;
  valor: number;
  descricao: string;
  categoria: string;
  subcategoria: string | null;
  /** "parcela" = compra parcelada; "fixa" = fixa ou recorrente; "variavel" = o resto. */
  natureza: "parcela" | "fixa" | "variavel";
  numero: number;
  total: number;
  paga: boolean;
  noCartao: boolean;
  projetada: boolean;
};

export type ItemReceita = {
  id: string;
  competencia: string;
  data: string;
  valor: number;
  descricao: string;
  categoria: string;
  fixa: boolean;
  projetada: boolean;
};

/** Competências de "inicio" até "fim" (AAAA-MM, inclusive, em ordem). */
export function intervaloCompetencias(inicio: string, fim: string): string[] {
  const de = inicio <= fim ? inicio : fim;
  const ate = inicio <= fim ? fim : inicio;
  const out: string[] = [];
  for (let c = de, g = 0; c <= ate && g < 360; c = somarMeses(c, 1), g++) out.push(c);
  return out;
}

/** N competências terminando em "fim" (inclusive). */
export function ultimasCompetencias(fim: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(fim, i - (n - 1)));
}

export function naturezaDaDespesa(d: any): ItemDespesa["natureza"] {
  if (d?.tipo !== "fixa" && Number(d?.total_parcelas) > 1) return "parcela";
  if (d?.tipo === "fixa" || d?.recorrencia_inicio) return "fixa";
  return "variavel";
}

/** Lançamentos de despesa (em BRL) das competências pedidas, como no Dashboard. Créditos ficam de fora. */
export function despesasPorCompetencia(
  despesas: any[],
  faturasMes: any[],
  competencias: string[],
  opcoes: {
    cotacao: number;
    macroDe: (nome: string | null | undefined) => string;
    cartoesCredito: Set<string>;
  },
): ItemDespesa[] {
  if (!competencias.length) return [];
  const desejadas = new Set(competencias);
  const ordenadas = [...desejadas].sort();
  // Uma competência a mais de cada lado: o filtro final é pelo dia do vencimento (ciclo de virada).
  const janela = intervaloCompetencias(somarMeses(ordenadas[0]!, -1), somarMeses(ordenadas[ordenadas.length - 1]!, 1));
  const lancamentos = aplicarRegrasFaturaMes(lancamentosPorCompetencias(despesas, janela), faturasMes);
  const out: ItemDespesa[] = [];
  for (const p of lancamentos as any[]) {
    const d = p.despesa ?? {};
    if (d.direcao === "credito") continue;
    const competencia = competenciaDoDia(p.vencimento);
    if (!desejadas.has(competencia)) continue;
    const categoriaOriginal = d.categoria || "Outros";
    const macro = opcoes.macroDe(categoriaOriginal) || categoriaOriginal;
    out.push({
      id: String(p.id),
      despesaId: String(d.id ?? p.despesa_id ?? ""),
      competencia,
      vencimento: String(p.vencimento ?? "").slice(0, 10),
      valor: toBRL(Number(p.valor), d.moeda ?? p.moeda ?? "BRL", opcoes.cotacao),
      descricao: d.descricao ?? "Sem descrição",
      categoria: macro,
      subcategoria: d.subcategoria || subDe(categoriaOriginal, macro) || null,
      natureza: naturezaDaDespesa(d),
      numero: Number(p.numero ?? 1),
      total: Number(d.total_parcelas ?? p.total ?? 1),
      paga: Boolean(p.paga),
      noCartao: Boolean(d.cartao_id && opcoes.cartoesCredito.has(String(d.cartao_id))),
      projetada: Boolean(p.projetada),
    });
  }
  return out;
}

/** Receitas (em BRL) das competências pedidas, com as fixas projetadas. */
export function receitasDaCompetencia(receitas: any[], competencias: string[], cotacao: number): ItemReceita[] {
  if (!competencias.length) return [];
  return receitasPorCompetencias(receitas, competencias).map((r) => ({
    id: r.id,
    competencia: r.competencia,
    data: String(r.data_recebimento ?? "").slice(0, 10),
    valor: toBRL(Number(r.valor), r.moeda, cotacao),
    descricao: r.descricao ?? "Receita",
    categoria: r.categoria || "Outros",
    fixa: r.tipo === "fixa",
    projetada: r.projetada,
  }));
}

export const somar = <T extends { valor: number }>(lista: T[]) => lista.reduce((s, x) => s + x.valor, 0);

export type Fatia = { nome: string; valor: number; pct: number };

/** Agrupa por chave, ordena do maior para o menor e calcula o percentual do total. */
export function agrupar<T extends { valor: number }>(lista: T[], chave: (x: T) => string): Fatia[] {
  const m = new Map<string, number>();
  for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + x.valor);
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m]
    .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
    .filter((f) => Math.abs(f.valor) > 0.004)
    .sort((a, b) => b.valor - a.valor);
}

export type LinhaMes = { key: string; receitas: number; despesas: number; resultado: number };

export function seriePorMes(competencias: string[], desp: ItemDespesa[], rec: ItemReceita[]): LinhaMes[] {
  return competencias.map((key) => {
    const receitas = somar(rec.filter((r) => r.competencia === key));
    const despesas = somar(desp.filter((d) => d.competencia === key));
    return { key, receitas, despesas, resultado: receitas - despesas };
  });
}

export type Dia = { data: string; entradas: number; saidas: number; saldo: number };

/**
 * Saldo acumulado dia a dia no período (começa em zero), seguindo o ciclo do dia de virada.
 * 07/11/2026: com `transferencias` (regra "Somar transferências"), cada transferência entre contas
 * do período entra como entrada e saída no mesmo dia: aparece nos totais e não muda o saldo.
 */
export function saldoDiario(
  competencias: string[],
  desp: ItemDespesa[],
  rec: ItemReceita[],
  opcoes: { transferencias?: { data: string; valor: number | string }[] | undefined } = {},
): Dia[] {
  const virada = diaViradaDefinida();
  const datas = competencias.flatMap((c) => datasDoCiclo(c, virada));
  const indice = new Map(datas.map((d, i) => [d, i]));
  const primeiroDia = new Map(competencias.map((c) => [c, datasDoCiclo(c, virada)[0]!]));
  const ent = new Array(datas.length).fill(0);
  const sai = new Array(datas.length).fill(0);
  const pos = (data: string, competencia: string) =>
    indice.get(data) ?? indice.get(primeiroDia.get(competencia) ?? "") ?? 0;
  for (const r of rec) ent[pos(r.data, r.competencia)] += r.valor;
  for (const d of desp) sai[pos(d.vencimento, d.competencia)] += d.valor;
  for (const t of opcoes.transferencias ?? []) {
    const i = indice.get(String(t.data ?? "").slice(0, 10));
    const valor = Number(t.valor) || 0;
    if (i === undefined || valor <= 0) continue;
    ent[i] += valor;
    sai[i] += valor;
  }
  let saldo = 0;
  return datas.map((data, i) => {
    saldo += ent[i] - sai[i];
    return { data, entradas: ent[i], saidas: sai[i], saldo };
  });
}

export type Parcelamento = {
  despesaId: string;
  descricao: string;
  categoria: string;
  valorParcela: number;
  total: number;
  pagas: number;
  restantes: number;
  faltaPagar: number;
  jaPago: number;
  proxima: string | null;
  termina: string;
};

/**
 * Compras parceladas (não fixas, mais de uma parcela). Uma parcela conta como paga quando foi
 * marcada como paga ou quando a competência já passou; o resto é "falta pagar".
 */
export function resumirParcelamentos(itens: ItemDespesa[], mesAtual: string): Parcelamento[] {
  const grupos = new Map<string, ItemDespesa[]>();
  for (const i of itens) {
    if (i.natureza !== "parcela") continue;
    const l = grupos.get(i.despesaId) ?? [];
    l.push(i);
    grupos.set(i.despesaId, l);
  }
  const out: Parcelamento[] = [];
  for (const [despesaId, lista] of grupos) {
    lista.sort((a, b) => a.competencia.localeCompare(b.competencia));
    const pago = (p: ItemDespesa) => p.paga || p.competencia < mesAtual;
    const abertas = lista.filter((p) => !pago(p));
    if (!abertas.length) continue;
    out.push({
      despesaId,
      descricao: lista[0]!.descricao,
      categoria: lista[0]!.categoria,
      valorParcela: abertas[0]!.valor,
      total: Math.max(lista[0]!.total, lista.length),
      pagas: lista.length - abertas.length,
      restantes: abertas.length,
      faltaPagar: somar(abertas),
      jaPago: somar(lista.filter(pago)),
      proxima: abertas[0]!.competencia,
      termina: lista[lista.length - 1]!.competencia,
    });
  }
  return out;
}

/** Todas as competências em que existem parcelas das compras parceladas (para buscar o histórico completo). */
export function competenciasDasParceladas(despesas: any[]): string[] {
  const s = new Set<string>();
  for (const d of despesas) {
    if (naturezaDaDespesa(d) !== "parcela") continue;
    for (const p of (d.parcelas ?? []) as any[]) {
      if (p?.vencimento) s.add(competenciaDoDia(p.vencimento));
    }
  }
  return [...s].sort();
}
