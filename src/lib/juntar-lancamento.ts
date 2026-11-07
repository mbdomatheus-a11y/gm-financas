import { competenciaDe } from "@/lib/recorrencia";
import { excluirDespesaSerie } from "@/lib/exclusao-recorrente";

/**
 * 07/11/2026: "Juntar com lançamento existente" (Open Finance x lançamento manual/recorrente).
 * Este arquivo é espelhado em controlall/src/lib/juntar-lancamento.ts: mudou aqui, muda lá.
 */

export type LancamentoOF = {
  despesaId: string;
  transactionId: string | null;
  descricao: string;
  valor: number;
  data: string; // AAAA-MM-DD
  categoria?: string | null;
  competencia: string; // AAAA-MM do ciclo
};

export type VinculoOF = { padrao_banco: string; nome_meu_norm: string; nome_meu: string };

export type Candidato = {
  parcelaId: string;
  despesaId: string;
  descricao: string;
  valor: number;
  vencimento: string;
  categoria: string | null;
  numero: number;
  total: number;
  projetada: boolean;
  recorrente: boolean;
  paga: boolean;
  despesa: any;
  score: number;
  porVinculo: boolean;
};

const RUIDO = new Set([
  "DEBITO", "AUT", "AUTOMATICO", "CTA", "CONTA", "PAGAMENTO", "PAGTO", "BOLETO", "PIX", "TED", "DOC", "COMPRA",
  "CARTAO", "ENVIADO", "RECEBIDO", "TRANSFERENCIA", "PARA", "DE", "DO", "DA", "DOS", "DAS", "COM", "LTDA", "EIRELI",
  "FATURA", "PAG", "DEB", "REF", "MES", "PARC",
]);

export function normalizarNome(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavras(s: string | null | undefined): string[] {
  return normalizarNome(s)
    .split(" ")
    .filter((p) => p.length >= 3 && !RUIDO.has(p));
}

/** 0 a 1: fração das palavras do nome mais curto que aparecem no outro (aceita prefixo de 4 letras). */
export function semelhancaNome(a: string | null | undefined, b: string | null | undefined): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (!pa.length || !pb.length) return 0;
  const [curto, longo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  const acertos = curto.filter((x) =>
    longo.some((y) => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y.slice(0, 4)) && y.startsWith(x.slice(0, 4))))),
  ).length;
  return acertos / curto.length;
}

function diasEntre(a: string, b: string): number {
  const da = Date.parse(`${a.slice(0, 10)}T12:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T12:00:00Z`);
  return Math.abs(da - db) / 86400000;
}

export function pontuar(of: LancamentoOF, c: { descricao: string; valor: number; vencimento: string; categoria?: string | null }, porVinculo: boolean) {
  if (!(of.valor > 0) || !(c.valor > 0)) return null;
  const dif = Math.abs(c.valor - of.valor) / Math.max(of.valor, c.valor);
  if (dif > 0.15) return null;
  const nome = semelhancaNome(of.descricao, c.descricao);
  const dias = diasEntre(of.data, c.vencimento);
  const sValor = 1 - dif / 0.15;
  const sData = Math.max(0, 1 - dias / 20);
  const sCat = of.categoria && c.categoria && of.categoria === c.categoria ? 1 : 0;
  return 0.45 * nome + 0.3 * sValor + 0.15 * sData + 0.1 * sCat + (porVinculo ? 0.5 : 0);
}

/** `lancamentos` = lancamentosPorCompetencias(despesas, [competencia]) (já inclui projetadas). */
export function listarCandidatos(of: LancamentoOF, lancamentos: any[], vinculos: VinculoOF[], busca = ""): Candidato[] {
  const padrao = normalizarNome(of.descricao);
  const nomesVinculados = new Set(vinculos.filter((v) => v.padrao_banco === padrao).map((v) => v.nome_meu_norm));
  const q = normalizarNome(busca);
  const out: Candidato[] = [];
  for (const l of lancamentos) {
    const d = l.despesa ?? {};
    if (!d || d.id === of.despesaId || d.origem === "pluggy" || d.pluggy_transaction_id) continue;
    if (d.economia_conquistada || d.direcao === "entrada") continue;
    const nomeNorm = normalizarNome(d.descricao);
    const porVinculo = nomesVinculados.has(nomeNorm);
    const item = { descricao: String(d.descricao ?? ""), valor: Number(l.valor), vencimento: String(l.vencimento), categoria: d.categoria ?? null };
    let score: number | null;
    if (q) {
      // Busca livre: ignora a faixa de valor; filtra pelo texto.
      if (!nomeNorm.includes(q) && !String(d.categoria ?? "").toUpperCase().includes(q)) continue;
      score = pontuar(of, item, porVinculo) ?? 0;
    } else {
      score = pontuar(of, item, porVinculo);
      if (score === null) continue;
    }
    out.push({
      parcelaId: String(l.id),
      despesaId: String(l.despesa_id),
      descricao: item.descricao,
      valor: item.valor,
      vencimento: item.vencimento,
      categoria: item.categoria,
      numero: Number(l.numero ?? 1),
      total: Number(l.total ?? 0),
      projetada: !!l.projetada,
      recorrente: !!d.recorrencia_inicio,
      paga: !!l.paga,
      despesa: d,
      score,
      porVinculo,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Melhor candidato só quando é convincente (nome parecido ou vínculo já feito). */
export function melhorSugestao(of: LancamentoOF, lancamentos: any[], vinculos: VinculoOF[]): Candidato | null {
  const [top] = listarCandidatos(of, lancamentos, vinculos);
  if (!top) return null;
  const nome = semelhancaNome(of.descricao, top.descricao);
  return top.porVinculo || (nome >= 0.5 && top.score >= 0.6) ? top : null;
}

export async function carregarVinculos(db: any): Promise<VinculoOF[]> {
  try {
    const { data } = await db.from("vinculos_open_finance").select("padrao_banco,nome_meu_norm,nome_meu");
    return (data ?? []) as VinculoOF[];
  } catch {
    return [];
  }
}

async function gravarVinculo(db: any, of: LancamentoOF, c: Candidato, escolha: "manter_meu" | "manter_open_finance") {
  // Falha aqui (tabela ainda sem migração) não desfaz a junção já feita.
  try {
    await db.from("vinculos_open_finance").upsert(
      {
        padrao_banco: normalizarNome(of.descricao),
        nome_meu: c.descricao,
        nome_meu_norm: normalizarNome(c.descricao),
        escolha,
        transaction_id: of.transactionId,
        competencia: of.competencia,
        grupo_id: c.despesa?.grupo_id ?? undefined,
      },
      { onConflict: "grupo_id,padrao_banco,nome_meu_norm" },
    );
  } catch {
    /* segue */
  }
}

/** Opção 1: fica o meu lançamento, pago com valor e data do banco; o do Open Finance sai e não volta. */
export async function juntarManterMeu(db: any, of: LancamentoOF, c: Candidato, rejeitar: (transactionId: string) => Promise<void>) {
  if (!of.transactionId) throw new Error("Este lançamento não tem identificador do banco.");
  const base = { valor: of.valor, paga: true, data_pagamento: of.data, origem: "importacao_substituicao", valor_estimado: false };
  if (c.projetada) {
    const { error } = await db.from("parcelas").insert({
      despesa_id: c.despesaId,
      numero: c.numero || 1,
      total: c.total || 1,
      moeda: c.despesa?.moeda ?? "BRL",
      vencimento: c.vencimento,
      ...base,
    });
    if (error) throw new Error("Não foi possível marcar o seu lançamento como pago.");
  } else {
    const { error } = await db.from("parcelas").update(base).eq("id", c.parcelaId);
    if (error) throw new Error("Não foi possível marcar o seu lançamento como pago.");
  }
  await rejeitar(of.transactionId);
  await gravarVinculo(db, of, c, "manter_meu");
}

/** Opção 2: fica o do Open Finance; só a parcela deste mês do meu lançamento sai. */
export async function juntarManterOpenFinance(db: any, of: LancamentoOF, c: Candidato) {
  if (c.recorrente) {
    await excluirDespesaSerie(db, c.despesaId, competenciaDe(of.competencia), "so_competencia");
  } else if (c.projetada) {
    throw new Error("Este lançamento não tem parcela real neste mês.");
  } else {
    const { error } = await db.from("parcelas").delete().eq("id", c.parcelaId);
    if (error) throw new Error("Não foi possível remover a parcela deste mês.");
    const { count } = await db.from("parcelas").select("id", { count: "exact", head: true }).eq("despesa_id", c.despesaId);
    if (!count) await db.from("despesas").delete().eq("id", c.despesaId);
  }
  await gravarVinculo(db, of, c, "manter_open_finance");
}
