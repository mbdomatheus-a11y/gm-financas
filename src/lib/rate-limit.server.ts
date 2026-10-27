import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Limite de requisições (rate limit) das server functions. 27/10/2026: passa a responder
 * HTTP 429 com o cabeçalho Retry-After (segundos), usando a função atômica `consumir_limite`
 * no banco (conta + registra numa chamada, com trava por chave). A chave (IP, e-mail ou id do
 * usuário) nunca é guardada em texto: só o hash sha256.
 *
 * Tabela de limites por rota: Obsidian, 03 - PADRÕES/rate-limit-control-all.md.
 */

export function hashValor(valor: string): string {
  return createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}

/** IP de origem da requisição atual (via `x-forwarded-for`, primeiro da lista). */
export function ipDaRequisicao(): string {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || "desconhecido";
}

function tempoLegivel(seg: number): string {
  if (seg < 60) return `${seg} segundo${seg === 1 ? "" : "s"}`;
  const min = Math.ceil(seg / 60);
  if (min < 60) return `${min} minuto${min === 1 ? "" : "s"}`;
  const h = Math.ceil(min / 60);
  return `${h} hora${h === 1 ? "" : "s"}`;
}

/** Resposta 429 com Retry-After. O texto vira a mensagem de erro mostrada no site. */
export function resposta429(retryAfterSeg: number, mensagem?: string): Response {
  const seg = Math.max(1, Math.ceil(retryAfterSeg));
  return new Response(mensagem ?? `Muitas tentativas. Tente de novo em ${tempoLegivel(seg)}.`, {
    status: 429,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(seg) },
  });
}

/**
 * Consome uma unidade do limite. Passou do limite: lança uma Response 429 com Retry-After
 * (a server function devolve essa resposta como está). Falha do banco não bloqueia (falha aberta),
 * para o site não parar por causa do limitador.
 */
export async function aplicarLimite(
  db: any,
  params: { rota: string; chave: string; maxPorJanela: number; janelaMinutos: number; mensagem?: string | undefined },
): Promise<void> {
  const { data, error } = await db.rpc("consumir_limite", {
    p_rota: params.rota,
    p_chave_hash: hashValor(params.chave),
    p_max: params.maxPorJanela,
    p_janela_seg: Math.round(params.janelaMinutos * 60),
  });
  if (error) return;
  const r = Array.isArray(data) ? data[0] : data;
  if (r && r.permitido === false) throw resposta429(Number(r.retry_after) || 60, params.mensagem);
}

export async function aplicarLimitePorIp(
  db: any,
  rota: string,
  maxPorJanela: number,
  janelaMinutos: number,
): Promise<void> {
  await aplicarLimite(db, { rota, chave: ipDaRequisicao(), maxPorJanela, janelaMinutos });
}

/** Atalho: limite por IP com o cliente admin do servidor. */
export async function limitarPorIp(rota: string, maxPorJanela: number, janelaMinutos: number): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await aplicarLimitePorIp(supabaseAdmin as any, rota, maxPorJanela, janelaMinutos);
}

/** Atalho: limite por usuário logado. */
export async function limitarPorUsuario(rota: string, userId: string, maxPorJanela: number, janelaMinutos: number, mensagem?: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await aplicarLimite(supabaseAdmin as any, { rota, chave: userId, maxPorJanela, janelaMinutos, mensagem });
}
