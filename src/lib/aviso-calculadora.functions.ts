import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Item 17 (2026-10-05): liga/desliga o aviso exibido ao entrar na calculadora.
 * Leitura para qualquer usuário autenticado; gravação só admin do site.
 */
export const obterAvisoCalculadora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("configuracoes_acesso_site")
      .select("exibir_aviso_calculadora")
      .eq("id", true)
      .maybeSingle();
    return { exibir: (data?.exibir_aviso_calculadora ?? true) as boolean };
  });

export const adminSalvarAvisoCalculadora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ exibir: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: souAdmin } = await db
      .from("site_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!souAdmin) throw new Error("Acesso restrito à administração do site.");
    const { error } = await db
      .from("configuracoes_acesso_site")
      .update({
        exibir_aviso_calculadora: data.exibir,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "aviso_calculadora_atualizado",
      detalhes: { exibir: data.exibir },
    });
    return { ok: true as const };
  });
