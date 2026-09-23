import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const meusComunicados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("comunicados")
      .select("id,titulo,mensagem,exige_aceite")
      .eq("ativo", true)
      .gt("expira_em", new Date().toISOString());
    if (error) throw new Error(error.message);
    const { data: aceitos } = await db
      .from("comunicado_aceites")
      .select("comunicado_id")
      .eq("user_id", context.userId);
    const ids = new Set((aceitos ?? []).map((x: any) => x.comunicado_id));
    return (data ?? []).filter((x: any) => !ids.has(x.id));
  });
export const aceitarComunicado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: comunicado, error: buscarErro } = await db
      .from("comunicados")
      .select("titulo,mensagem")
      .eq("id", data.id)
      .single();
    if (buscarErro) throw new Error(buscarErro.message);
    const { error } = await db
      .from("comunicado_aceites")
      .upsert({ comunicado_id: data.id, user_id: context.userId });
    if (error) throw new Error(error.message);
    const { data: jaRegistrado } = await db
      .from("historico_alertas_usuario")
      .select("id")
      .eq("user_id", context.userId)
      .eq("referencia_tipo", "comunicado")
      .eq("referencia_id", data.id)
      .maybeSingle();
    if (!jaRegistrado)
      await db.from("historico_alertas_usuario").insert({
        user_id: context.userId,
        tipo: "comunicado",
        titulo: comunicado.titulo,
        mensagem: comunicado.mensagem,
        referencia_tipo: "comunicado",
        referencia_id: data.id,
        lido_em: new Date().toISOString(),
      });
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "comunicado_aceito",
      alvo_id: data.id,
      detalhes: {},
    });
    return { ok: true as const };
  });

export const meuHistoricoAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("historico_alertas_usuario")
      .select("id,tipo,titulo,mensagem,exibido_em,lido_em")
      .eq("user_id", context.userId)
      .order("exibido_em", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const minhasChavesAlertasLidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("alertas_lidos")
      .select("chave")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((x: any) => x.chave as string);
  });
export const marcarAlertaLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        chave: z.string().min(3).max(300),
        titulo: z.string().max(180),
        mensagem: z.string().max(1000),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    await db
      .from("alertas_lidos")
      .upsert({ user_id: context.userId, chave: data.chave, lido_em: new Date().toISOString() });
    await db.from("historico_alertas_usuario").insert({
      user_id: context.userId,
      tipo: "alerta",
      titulo: data.titulo,
      mensagem: data.mensagem,
      lido_em: new Date().toISOString(),
      referencia_tipo: "alerta",
      referencia_id: null,
    });
    return { ok: true as const };
  });
