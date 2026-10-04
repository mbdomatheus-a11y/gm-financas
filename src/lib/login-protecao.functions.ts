import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function hash(identificador: string) {
  return createHash("sha256").update(identificador.trim().toLowerCase()).digest("hex");
}

// Nota de segurança (item 15 do backlog, revisão de 2026-09-26):
// `consultarBloqueioLogin` e `registrarFalhaLogin` foram removidas daqui —
// eram server functions públicas (sem `requireSupabaseAuth`) que não
// tinham nenhum uso na UI (confirmado por busca em todo o repositório) mas
// continuavam expostas por HTTP. `registrarFalhaLogin` em especial permitia
// que qualquer pessoa, sem autenticação, chamasse
// `registrar_tentativa_login` (RPC SECURITY DEFINER) e bloqueasse a conta
// de qualquer usuário só sabendo o e-mail/CPF (o hash é sha256 simples),
// sem nunca tentar a senha real — o fluxo real de login (`iniciarLoginSeguro`
// em seguranca-conta.functions.ts) já registra falhas e sucessos por conta
// própria, então essas duas funções eram código morto e superfície de
// ataque desnecessária.

export const registrarSucessoLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ identificador: z.string().min(3).max(180) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).rpc("registrar_tentativa_login", {
      p_hash: hash(data.identificador),
      p_sucesso: true,
    });
    await (supabaseAdmin as any).from("eventos_sessao").insert({ user_id: context.userId });
    return { ok: true as const };
  });

export const registrarAtividadeSessao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: ultima, error } = await db
      .from("eventos_sessao")
      .select("id,ultima_atividade_em")
      .eq("user_id", context.userId)
      .is("encerrou_em", null)
      .order("iniciou_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Não foi possível registrar a atividade.");
    const agora = new Date();
    if (ultima && agora.getTime() - new Date(ultima.ultima_atividade_em).getTime() < 30_000)
      return { ok: true as const };
    const result = ultima
      ? await db
          .from("eventos_sessao")
          .update({ ultima_atividade_em: agora.toISOString() })
          .eq("id", ultima.id)
      : await db
          .from("eventos_sessao")
          .insert({ user_id: context.userId, ultima_atividade_em: agora.toISOString() });
    if (result.error) throw new Error("Não foi possível registrar a atividade.");
    return { ok: true as const };
  });

export const encerrarSessao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ motivo: z.enum(["usuario", "inatividade"]) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("eventos_sessao")
      .update({ encerrou_em: new Date().toISOString(), motivo_encerramento: data.motivo })
      .eq("user_id", context.userId)
      .is("encerrou_em", null);
    if (error) throw new Error("Não foi possível encerrar o histórico da sessão.");
    return { ok: true as const };
  });
