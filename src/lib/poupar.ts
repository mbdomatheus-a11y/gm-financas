import { supabase } from "@/integrations/supabase/client";
import { monthKey, competenciaAtual } from "@/lib/format";
import { somarMeses } from "@/lib/recorrencia";

/**
 * Caixinhas (objetivo + valor por mês + aporte marcado mês a mês). Mesmas tabelas e mesmas regras do
 * app (controlall/src/lib/poupar.ts), 27/10/2026: o valor a guardar no mês entra na Previsão do mês.
 */
export type Caixinha = {
  id: string;
  nome: string;
  valorMensal: number;
  inicio: string;
  fim: string | null;
  aportes: Record<string, number>;
  criadaEm: string;
  /** Metas (07/11/2026, migration 20261107130000_caixinhas_metas.sql). null quando não definido. */
  valorAlvo?: number | null;
  /** Mês alvo "YYYY-MM" (vem de data_alvo). */
  dataAlvo?: string | null;
  /** Nome do ícone (ver ICONES_CAIXINHA na tela) ou emoji. */
  imagem?: string | null;
  cor?: string | null;
};
export type CaixinhaForm = {
  nome: string;
  valorMensal: number;
  inicio: string;
  fim: string | null;
  valorAlvo?: number | null;
  dataAlvo?: string | null;
  imagem?: string | null;
  cor?: string | null;
};
export type MesCaixinha = { mes: string; meta: number; aportado: number; situacao: "atingiu" | "faltou" | "aberto" | "futuro" };

const COLUNAS = "id, nome, valor_mensal, inicio, fim, created_at";
const COLUNAS_METAS = `${COLUNAS}, valor_alvo, data_alvo, imagem, cor`;

/** Coluna nova ainda não criada no banco (migration pendente). */
function colunaPendente(error: any): boolean {
  const code = String(error?.code ?? "");
  return code === "42703" || code === "PGRST204";
}
const mesParaData = (mes: string) => `${mes}-01`;
const dataParaMes = (d: string) => d.slice(0, 7);
const arred = (v: number) => Math.round(v * 100) / 100;
const db = () => supabase as any;

async function contexto(): Promise<{ userId: string; grupoId: string }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Entre de novo.");
  const { data: p } = await db().from("profiles").select("grupo_id").eq("id", u.user.id).maybeSingle();
  if (!p?.grupo_id) throw new Error("Seu usuário não está em um grupo.");
  return { userId: u.user.id, grupoId: p.grupo_id };
}

function montar(c: any, aportes: any[]): Caixinha {
  const mapa: Record<string, number> = {};
  for (const a of aportes) if (a.caixinha_id === c.id) mapa[dataParaMes(a.competencia)] = Number(a.valor);
  return {
    id: c.id,
    nome: c.nome,
    valorMensal: Number(c.valor_mensal),
    inicio: dataParaMes(c.inicio),
    fim: c.fim ? dataParaMes(c.fim) : null,
    aportes: mapa,
    criadaEm: c.created_at,
    valorAlvo: c.valor_alvo != null && Number(c.valor_alvo) > 0 ? Number(c.valor_alvo) : null,
    dataAlvo: c.data_alvo ? dataParaMes(String(c.data_alvo)) : null,
    imagem: c.imagem ?? null,
    cor: c.cor ?? null,
  };
}

/**
 * Lista as caixinhas e diz se as colunas de meta já existem (metasPendentes = migration não aplicada).
 * Com a migration pendente, cai para as colunas antigas e a tela esconde alvo, prazo, ícone e cor.
 */
export async function listarCaixinhasComMetas(): Promise<{ lista: Caixinha[]; metasPendentes: boolean }> {
  let metasPendentes = false;
  let r = await db().from("caixinhas").select(COLUNAS_METAS).order("created_at", { ascending: true });
  if (r.error && colunaPendente(r.error)) {
    metasPendentes = true;
    r = await db().from("caixinhas").select(COLUNAS).order("created_at", { ascending: true });
  }
  if (r.error) throw new Error("Não foi possível carregar as caixinhas.");
  const linhas = (r.data ?? []) as any[];
  if (!linhas.length) return { lista: [], metasPendentes };
  const { data: aportes, error: e2 } = await db().from("caixinha_aportes").select("caixinha_id, competencia, valor").in("caixinha_id", linhas.map((l) => l.id));
  if (e2) throw new Error("Não foi possível carregar os aportes.");
  return { lista: linhas.map((l) => montar(l, aportes ?? [])), metasPendentes };
}

export async function listarCaixinhas(): Promise<Caixinha[]> {
  return (await listarCaixinhasComMetas()).lista;
}

export async function salvarCaixinha(form: CaixinhaForm, id?: string | null): Promise<void> {
  if (!form.nome.trim()) throw new Error("Dê um nome ao objetivo.");
  if (!(form.valorMensal > 0)) throw new Error("Informe um valor por mês maior que zero.");
  if (!/^\d{4}-\d{2}$/.test(form.inicio)) throw new Error("Mês de início inválido.");
  if (form.fim && (!/^\d{4}-\d{2}$/.test(form.fim) || form.fim < form.inicio)) throw new Error("Mês final inválido.");
  if (form.valorAlvo != null && !(form.valorAlvo > 0)) throw new Error("O valor da meta precisa ser maior que zero.");
  if (form.dataAlvo && !/^\d{4}-\d{2}$/.test(form.dataAlvo)) throw new Error("Prazo da meta inválido.");
  const base = { nome: form.nome.trim(), valor_mensal: arred(form.valorMensal), inicio: mesParaData(form.inicio), fim: form.fim ? mesParaData(form.fim) : null };
  // Campos de meta só vão quando a tela os enviou (undefined = migration pendente, não mexe).
  const metas: { valor_alvo?: number | null; data_alvo?: string | null; imagem?: string | null; cor?: string | null } = {};
  if (form.valorAlvo !== undefined) metas.valor_alvo = form.valorAlvo == null ? null : arred(form.valorAlvo);
  if (form.dataAlvo !== undefined) metas.data_alvo = form.dataAlvo ? mesParaData(form.dataAlvo) : null;
  if (form.imagem !== undefined) metas.imagem = form.imagem || null;
  if (form.cor !== undefined) metas.cor = form.cor || null;
  const dados = { ...base, ...metas };
  if (id) {
    let { error } = await db().from("caixinhas").update(dados).eq("id", id);
    if (error && colunaPendente(error) && Object.keys(metas).length) ({ error } = await db().from("caixinhas").update(base).eq("id", id));
    if (error) throw new Error("Não foi possível salvar a caixinha.");
    return;
  }
  const { userId, grupoId } = await contexto();
  let { error } = await db().from("caixinhas").insert({ ...dados, grupo_id: grupoId, created_by: userId });
  if (error && colunaPendente(error) && Object.keys(metas).length)
    ({ error } = await db().from("caixinhas").insert({ ...base, grupo_id: grupoId, created_by: userId }));
  if (error) throw new Error("Não foi possível criar a caixinha.");
}

/** Quantos meses de `de` até `ate` (inclusive). 0 quando `ate` já passou. */
export function mesesEntre(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  const n = (a2! * 12 + m2!) - (a1! * 12 + m1!) + 1;
  return n > 0 ? n : 0;
}

export type ProgressoMeta = {
  alvo: number;
  guardado: number;
  falta: number;
  percentual: number;
  concluida: boolean;
  /** Meses que ainda dá para guardar até o prazo (null sem prazo). */
  mesesRestantes: number | null;
  /** Quanto guardar por mês para chegar no prazo (null sem prazo ou já concluída). */
  porMesNecessario: number | null;
  /** Prazo já passou sem atingir o alvo. */
  atrasada: boolean;
};

/**
 * Progresso da meta (07/11/2026). Sem valor alvo, usa o objetivo antigo (meses do início ao fim x valor
 * por mês) quando a caixinha tem fim. O mês atual só conta como "a guardar" se ainda não teve aporte.
 */
export function progressoMeta(c: Caixinha, hoje = competenciaAtual()): ProgressoMeta | null {
  const guardado = totalGuardado(c);
  const prazo = c.dataAlvo ?? c.fim ?? null;
  const alvo = c.valorAlvo ?? (c.fim ? mesesEntre(c.inicio, c.fim) * c.valorMensal : null);
  if (alvo == null || !(alvo > 0)) return null;
  const falta = arred(Math.max(0, alvo - guardado));
  const concluida = falta <= 0.005;
  let mesesRestantes: number | null = null;
  if (prazo) {
    const desde = (c.aportes[hoje] ?? 0) > 0 ? somarMeses(hoje, 1) : hoje;
    mesesRestantes = mesesEntre(desde > c.inicio ? desde : c.inicio, prazo);
  }
  const porMesNecessario =
    concluida || mesesRestantes == null || mesesRestantes === 0 ? null : arred(falta / mesesRestantes);
  return {
    alvo,
    guardado,
    falta,
    percentual: Math.min(100, (guardado / alvo) * 100),
    concluida,
    mesesRestantes,
    porMesNecessario,
    atrasada: !concluida && !!prazo && mesesRestantes === 0,
  };
}

export async function excluirCaixinha(id: string): Promise<void> {
  await db().from("caixinha_aportes").delete().eq("caixinha_id", id);
  const { error } = await db().from("caixinhas").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir a caixinha.");
}

/** Marca (valor) ou desmarca (null) o aporte de um mês. */
export async function registrarAporte(id: string, mes: string, valor: number | null): Promise<void> {
  if (valor == null || !(valor > 0)) {
    const { error } = await db().from("caixinha_aportes").delete().eq("caixinha_id", id).eq("competencia", mesParaData(mes));
    if (error) throw new Error("Não foi possível desmarcar o aporte.");
    return;
  }
  const { userId, grupoId } = await contexto();
  const { error } = await db()
    .from("caixinha_aportes")
    .upsert({ grupo_id: grupoId, created_by: userId, caixinha_id: id, competencia: mesParaData(mes), valor: arred(valor) }, { onConflict: "caixinha_id,competencia" });
  if (error) throw new Error("Não foi possível registrar o aporte.");
}

export function ativaNoMes(c: Caixinha, mes: string): boolean {
  return mes >= c.inicio && (!c.fim || mes <= c.fim);
}
/** Valor a guardar no mês: soma das caixinhas ativas. Entra na Previsão do mês (igual ao app). */
export function metaDoMes(lista: Caixinha[], mes: string): number {
  return lista.filter((c) => ativaNoMes(c, mes)).reduce((s, c) => s + c.valorMensal, 0);
}
export function aportadoNoMes(lista: Caixinha[], mes: string): number {
  return lista.reduce((s, c) => s + (c.aportes[mes] ?? 0), 0);
}
export function totalGuardado(c: Caixinha): number {
  return Object.values(c.aportes).reduce((s, v) => s + (Number(v) || 0), 0);
}
export function linhaDoTempo(c: Caixinha, hoje = competenciaAtual(), aFrente = 2): MesCaixinha[] {
  const limite = c.fim ?? somarMeses(hoje > c.inicio ? hoje : c.inicio, aFrente);
  const out: MesCaixinha[] = [];
  let mes = c.inicio;
  for (let n = 0; mes <= limite && n < 240; n++, mes = somarMeses(c.inicio, n)) {
    const aportado = c.aportes[mes] ?? 0;
    const situacao: MesCaixinha["situacao"] = aportado >= c.valorMensal - 0.005 ? "atingiu" : mes > hoje ? "futuro" : mes === hoje ? "aberto" : "faltou";
    out.push({ mes, meta: c.valorMensal, aportado, situacao });
  }
  return out;
}
