import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSiteAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
  if (!data) throw new Error("Apenas o administrador do site pode alterar a marca.");
}

export const prepararUploadLogo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ nome: z.string().min(1).max(140) }).parse(value))
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `logo/${crypto.randomUUID()}-${data.nome.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: signed, error } = await (supabaseAdmin as any).storage.from("site_assets").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const confirmarLogo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ path: z.string().regex(/^logo\/[A-Za-z0-9._-]+$/) }).parse(value))
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("identidade_visual_site").upsert({ id: true, logo_path: data.path, atualizado_em: new Date().toISOString(), atualizado_por: context.userId });
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({ ator_id: context.userId, acao: "logo_atualizada", detalhes: {} });
    return { ok: true as const };
  });

/**
 * Item 4 do backlog de 2026-09-26: vídeo de demonstração da home,
 * administrável (upload/troca) pelo admin do site — mesmo padrão da logo,
 * mas usando o bucket `site_videos` (maior, aceita mp4/webm/mov).
 */
export const prepararUploadVideo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ nome: z.string().min(1).max(140) }).parse(value))
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `demonstracao/${crypto.randomUUID()}-${data.nome.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: signed, error } = await (supabaseAdmin as any).storage.from("site_videos").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const confirmarVideo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ path: z.string().regex(/^demonstracao\/[A-Za-z0-9._-]+$/).nullable() }).parse(value))
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("identidade_visual_site").upsert({ id: true, video_demonstracao_path: data.path, atualizado_em: new Date().toISOString(), atualizado_por: context.userId });
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({ ator_id: context.userId, acao: data.path ? "video_demonstracao_atualizado" : "video_demonstracao_removido", detalhes: {} });
    return { ok: true as const };
  });
