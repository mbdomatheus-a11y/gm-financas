import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Limite de tentativas reaproveitável por qualquer server function pública
 * (item 15 do backlog — revisão de segurança). Usa a tabela genérica
 * `rate_limit_eventos` (só acessível via service_role) para contar quantos
 * eventos de uma "chave" (normalmente o IP, às vezes um e-mail) aconteceram
 * numa rota nos últimos `janelaMinutos`. Se o limite já foi atingido, lança
 * erro; senão, registra o evento atual e segue.
 *
 * A chave nunca é guardada em texto puro — só o hash sha256.
 */

export function hashValor(valor: string): string {
  return createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}

/** IP de origem da requisição atual (via `x-forwarded-for`, primeiro da lista). */
export function ipDaRequisicao(): string {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "desconhecido";
}

export async function aplicarLimitePorIp(
  db: any,
  rota: string,
  maxPorJanela: number,
  janelaMinutos: number,
): Promise<void> {
  await aplicarLimite(db, { rota, chave: ipDaRequisicao(), maxPorJanela, janelaMinutos });
}

export async function aplicarLimite(
  db: any,
  params: { rota: string; chave: string; maxPorJanela: number; janelaMinutos: number },
): Promise<void> {
  const chaveHash = hashValor(params.chave);
  const desde = new Date(Date.now() - params.janelaMinutos * 60_000).toISOString();
  const { count } = await db
    .from("rate_limit_eventos")
    .select("id", { count: "exact", head: true })
    .eq("rota", params.rota)
    .eq("chave_hash", chaveHash)
    .gte("criado_em", desde);
  if ((count ?? 0) >= params.maxPorJanela) {
    throw new Error("Muitas tentativas. Tente novamente mais tarde.");
  }
  await db.from("rate_limit_eventos").insert({ rota: params.rota, chave_hash: chaveHash });
}
