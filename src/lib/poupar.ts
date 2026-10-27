import { supabase } from "@/integrations/supabase/client";
import { monthKey } from "@/lib/format";
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
};
export type CaixinhaForm = { nome: string; valorMensal: number; inicio: string; fim: string | null };
export type MesCaixinha = { mes: string; meta: number; aportado: number; situacao: "atingiu" | "faltou" | "aberto" | "futuro" };

const COLUNAS = "id, nome, valor_mensal, inicio, fim, created_at";
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
  return { id: c.id, nome: c.nome, valorMensal: Number(c.valor_mensal), inicio: dataParaMes(c.inicio), fim: c.fim ? dataParaMes(c.fim) : null, aportes: mapa, criadaEm: c.created_at };
}

export async function listarCaixinhas(): Promise<Caixinha[]> {
  const { data, error } = await db().from("caixinhas").select(COLUNAS).order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar as caixinhas.");
  const linhas = (data ?? []) as any[];
  if (!linhas.length) return [];
  const { data: aportes, error: e2 } = await db().from("caixinha_aportes").select("caixinha_id, competencia, valor").in("caixinha_id", linhas.map((l) => l.id));
  if (e2) throw new Error("Não foi possível carregar os aportes.");
  return linhas.map((l) => montar(l, aportes ?? []));
}

export async function salvarCaixinha(form: CaixinhaForm, id?: string | null): Promise<void> {
  if (!form.nome.trim()) throw new Error("Dê um nome ao objetivo.");
  if (!(form.valorMensal > 0)) throw new Error("Informe um valor por mês maior que zero.");
  if (!/^\d{4}-\d{2}$/.test(form.inicio)) throw new Error("Mês de início inválido.");
  if (form.fim && (!/^\d{4}-\d{2}$/.test(form.fim) || form.fim < form.inicio)) throw new Error("Mês final inválido.");
  const dados = { nome: form.nome.trim(), valor_mensal: arred(form.valorMensal), inicio: mesParaData(form.inicio), fim: form.fim ? mesParaData(form.fim) : null };
  if (id) {
    const { error } = await db().from("caixinhas").update(dados).eq("id", id);
    if (error) throw new Error("Não foi possível salvar a caixinha.");
    return;
  }
  const { userId, grupoId } = await contexto();
  const { error } = await db().from("caixinhas").insert({ ...dados, grupo_id: grupoId, created_by: userId });
  if (error) throw new Error("Não foi possível criar a caixinha.");
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
export function linhaDoTempo(c: Caixinha, hoje = monthKey(new Date()), aFrente = 2): MesCaixinha[] {
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
