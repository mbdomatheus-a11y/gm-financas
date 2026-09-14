import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Valida um token do Cloudflare Turnstile contra a API oficial `siteverify`.
 * Requer a variável de ambiente `TURNSTILE_SECRET_KEY` configurada como
 * secret no Lovable (Project Settings → Secrets) — nunca é exposta ao
 * client, e nunca deve ser colada em chat/código-fonte.
 */
export async function verificarTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) {
    console.error("[Turnstile] TURNSTILE_SECRET_KEY não configurada — verificação bloqueada.");
    return false;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

/** Endpoint público (sem sessão) usado só para checagens avulsas no client. */
export const verificarTurnstile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => ({ ok: await verificarTurnstileToken(data.token) }));
