import { supabase } from "@/integrations/supabase/client";
import { diaMesCurto, fechamentoDaFatura, janelasDoCiclo } from "@/lib/numeros-ciclo";

/**
 * Regra do ciclo do GRUPO (08/11/2026, docs/regra-ciclo-2026-11-08.md).
 * Tabelas: regra_ciclo_grupo, economia_ciclos e as colunas cartoes.regra_revisada_em / vencimento_revisado
 * (migration 20261108100000_regra_ciclo_grupo.sql). Enquanto a migration não roda, tudo aqui devolve
 * "indisponível" e o site segue com a virada antiga das preferências, sem abrir o assistente.
 */

export type RegraCiclo = {
  grupo_id: string;
  dia_virada: number;
  dia_anterior: number | null;
  configurado_por: string | null;
  configurado_por_nome: string | null;
  configurado_em: string;
  atualizado_por: string | null;
  atualizado_por_nome: string | null;
  atualizado_em: string;
};

export type EstadoRegraCiclo = { disponivel: boolean; regra: RegraCiclo | null };

/** Tabela ou coluna ainda não criada (migration pendente). */
export function estruturaAusente(error: any): boolean {
  if (!error) return false;
  if (["42P01", "PGRST205", "42703", "PGRST204"].includes(String(error.code ?? ""))) return true;
  return /does not exist|could not find the (table|.* column)|schema cache/i.test(String(error.message ?? ""));
}

export async function buscarRegraCiclo(): Promise<EstadoRegraCiclo> {
  const { data, error } = await (supabase as any).from("regra_ciclo_grupo").select("*").maybeSingle();
  if (error) {
    if (estruturaAusente(error)) return { disponivel: false, regra: null };
    throw error;
  }
  return { disponivel: true, regra: (data as RegraCiclo | null) ?? null };
}

/** Grava a regra do grupo (insere ou altera). Quem e quando são preenchidos pelo banco. */
export async function salvarRegraCiclo(dia: number, grupoId?: string | null): Promise<void> {
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) throw new Error("Escolha um dia entre 1 e 28.");
  const linha: Record<string, unknown> = { dia_virada: dia };
  if (grupoId) linha["grupo_id"] = grupoId;
  const { error } = await (supabase as any).from("regra_ciclo_grupo").upsert(linha, { onConflict: "grupo_id" });
  if (error) throw error;
}

/** Marca o cartão como revisado na regra (guarda o vencimento confirmado). */
export async function marcarCartaoRevisado(cartaoId: string, diaVencimento: number | null | undefined): Promise<void> {
  const { error } = await (supabase as any)
    .from("cartoes")
    .update({ regra_revisada_em: new Date().toISOString(), vencimento_revisado: diaVencimento ?? null })
    .eq("id", cartaoId);
  if (error && !estruturaAusente(error)) throw error;
}

/** Cartão de crédito que ainda não foi revisado na regra (ou cujo vencimento mudou depois da revisão). */
export function cartaoPrecisaRevisao(c: any): boolean {
  if (c?.tipo && c.tipo !== "credito") return false;
  if (!("regra_revisada_em" in (c ?? {}))) return false; // coluna ainda não existe
  if (!c.regra_revisada_em) return true;
  return c.vencimento_revisado != null && Number(c.vencimento_revisado) !== Number(c.dia_vencimento);
}

export type EconomiaCiclo = { grupo_id: string; ciclo_inicio: string; ciclo_fim: string; valor_centavos: number; calculado_em: string };

export async function listarEconomiaCiclos(): Promise<{ disponivel: boolean; lista: EconomiaCiclo[] }> {
  const { data, error } = await (supabase as any)
    .from("economia_ciclos")
    .select("*")
    .order("ciclo_inicio", { ascending: false });
  if (error) {
    if (estruturaAusente(error)) return { disponivel: false, lista: [] };
    throw error;
  }
  return { disponivel: true, lista: (data ?? []) as EconomiaCiclo[] };
}

/** Grava (upsert) o resultado de um ciclo fechado. */
export async function gravarEconomiaCiclo(inicio: string, fim: string, valor: number, grupoId?: string | null): Promise<void> {
  const linha: Record<string, unknown> = {
    ciclo_inicio: inicio,
    ciclo_fim: fim,
    valor_centavos: Math.round(valor * 100),
    calculado_em: new Date().toISOString(),
  };
  if (grupoId) linha["grupo_id"] = grupoId;
  const { error } = await (supabase as any).from("economia_ciclos").upsert(linha, { onConflict: "grupo_id,ciclo_inicio" });
  if (error && !estruturaAusente(error)) throw error;
}

/** Nome curto do cartão para as frases. */
export function nomeCartao(c: any): string {
  return `${c?.apelido || c?.bandeira || "Cartão"}${c?.final ? ` •${c.final}` : ""}`;
}

/**
 * Frase da confirmação do cartão (regra corrigida em 09/11/2026: receitas do mês pagam as contas e faturas
 * do mês seguinte; fatura de cartão entra pelo FECHAMENTO): "O Nubank fecha dia 13 e vence dia 20. A fatura
 * entra no ciclo pelo mês do fechamento (fecha em novembro: ciclo 16/out a 15/nov)
 *  (ex.: fatura que fecha em 13/nov e vence em 20/nov, receitas de 16/out a 15/nov)."
 */
export function fraseCartaoNoCiclo(
  nome: string,
  diaVencimento: number,
  diaVirada: number,
  agora: Date = new Date(),
  diaFechamento?: number | null,
): string {
  const v = Number(diaVencimento);
  const d = Number(diaVirada);
  const ex = exemploFaturaNoCiclo(v, d, agora, diaFechamento);
  const dias = diaFechamento ? `fecha dia ${diaFechamento} e vence dia ${v}` : `vence dia ${v}`;
  return `O ${nome} ${dias}. A fatura entra no ciclo pelo mês do fechamento (ex.: fatura que fecha em ${diaMesCurto(ex.fechamento)} e vence em ${diaMesCurto(ex.fatura)} é paga com as receitas de ${ex.ciclo.rotulo}).`;
}

const iso = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

/** Próxima fatura (a partir de hoje), o fechamento dela e o dia D do ciclo em que ela é paga (mês anterior ao fechamento). */
export function exemploFaturaNoCiclo(diaVencimento: number, diaVirada: number, agora: Date = new Date(), diaFechamento?: number | null) {
  const ultimo = (a: number, m: number) => new Date(a, m + 1, 0).getDate();
  let a = agora.getFullYear();
  let m = agora.getMonth();
  let f = new Date(a, m, Math.min(diaVencimento, ultimo(a, m)));
  if (iso(f) < iso(agora)) {
    m += 1;
    f = new Date(a, m, Math.min(diaVencimento, ultimo(a, m)));
  }
  // A fatura entra no ciclo pelo mês do fechamento (fecha em nov: ciclo 16/out a 15/nov, chave "AAAA-10").
  const fech = fechamentoDaFatura(iso(f), diaFechamento ?? null);
  const [fa = 1970, fm = 1] = fech.split("-").map(Number);
  const sal = new Date(fa, fm - 2, diaVirada + 1);
  const mes = `${sal.getFullYear()}-${String(sal.getMonth() + 1).padStart(2, "0")}`;
  return { fatura: iso(f), fechamento: fech, salario: iso(sal), ciclo: janelasDoCiclo(mes, diaVirada) };
}

/** Em qual ciclo cai a fatura do cartão: "Fatura que fecha em 13/nov (vence 20/nov) entra no ciclo 16/out a 15/nov". */
export function textoFaturaNoCiclo(diaVencimento: number, diaVirada: number, agora: Date = new Date(), diaFechamento?: number | null): string {
  const ex = exemploFaturaNoCiclo(diaVencimento, diaVirada, agora, diaFechamento);
  return `Fatura que fecha em ${diaMesCurto(ex.fechamento)} (vence ${diaMesCurto(ex.fatura)}) entra no ciclo ${ex.ciclo.rotulo}`;
}

/** Evento para abrir o assistente do ciclo de qualquer tela (Configurações, "Mudar a virada"). */
export const EVENTO_ABRIR_CICLO = "controlall:abrir-configurar-ciclo";
export function abrirConfigurarCiclo() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_CICLO));
}
