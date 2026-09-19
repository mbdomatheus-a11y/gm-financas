import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function hash(identificador: string) {
  return createHash("sha256").update(identificador.trim().toLowerCase()).digest("hex");
}

export const consultarBloqueioLogin = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ identificador: z.string().min(3).max(180) }).parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tentativa, error } = await (supabaseAdmin as any)
      .from("login_tentativas")
      .select("bloqueado_ate")
      .eq("identificador_hash", hash(data.identificador))
      .maybeSingle();
    if (error) throw new Error("Não foi possível verificar a segurança do acesso.");
    const bloqueadoAte = tentativa?.bloqueado_ate ? new Date(tentativa.bloqueado_ate) : null;
    return { bloqueadoAte: bloqueadoAte && bloqueadoAte > new Date() ? bloqueadoAte.toISOString() : null };
  });

export const registrarFalhaLogin = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ identificador: z.string().min(3).max(180) }).parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tentativa, error } = await (supabaseAdmin as any).rpc("registrar_tentativa_login", {
      p_hash: hash(data.identificador), p_sucesso: false,
    });
    if (error) throw new Error("Não foi possível registrar a tentativa de acesso.");
    const retorno = Array.isArray(tentativa) ? tentativa[0] : tentativa;
    return { bloqueadoAte: retorno?.bloqueado_ate ?? null, falhas: retorno?.falhas ?? 0 };
  });

export const registrarSucessoLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ identificador: z.string().min(3).max(180) }).parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).rpc("registrar_tentativa_login", { p_hash: hash(data.identificador), p_sucesso: true });
    await (supabaseAdmin as any).from("eventos_sessao").insert({ user_id: context.userId });
    return { ok: true as const };
  });
