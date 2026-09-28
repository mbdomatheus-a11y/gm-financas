import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

/**
 * Tour guiado (2026-09-28): mostrado logo depois do aviso de boas-vindas,
 * destaca "lançar uma receita" e "lançar uma despesa" pra quem é novo no
 * site. Mesmo mecanismo de "reset via delete" já usado nos comunicados —
 * "reenviar pra todos" é só apagar as linhas de `tour_concluido`, sem
 * precisar de contador de versão.
 */
export const meuTourStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: config }, { data: concluido }] = await Promise.all([
      db.from("tour_config").select("ativo").eq("id", true).maybeSingle(),
      db.from("tour_concluido").select("user_id").eq("user_id", context.userId).maybeSingle(),
    ]);
    return { ativo: !!config?.ativo, concluido: !!concluido };
  });

export const concluirTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("tour_concluido")
      .upsert({ user_id: context.userId, concluido_em: new Date().toISOString() });
    return { ok: true as const };
  });

export const adminObterTourConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: config }, { count }] = await Promise.all([
      db.from("tour_config").select("ativo").eq("id", true).single(),
      db.from("tour_concluido").select("user_id", { count: "exact", head: true }),
    ]);
    return { ativo: !!config?.ativo, concluidos: count ?? 0 };
  });

export const adminAlternarTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => {
    if (typeof v !== "object" || v === null || typeof (v as any).ativo !== "boolean") {
      throw new Error("Parâmetro inválido.");
    }
    return v as { ativo: boolean };
  })
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("tour_config")
      .update({
        ativo: data.ativo,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "tour_guiado_alternado",
      detalhes: { ativo: data.ativo },
    });
    return { ok: true as const };
  });

export const adminReenviarTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("tour_concluido").delete().gte("concluido_em", "1970-01-01");
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "tour_guiado_reenviado",
    });
    return { ok: true as const };
  });
