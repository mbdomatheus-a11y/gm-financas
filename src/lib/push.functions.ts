import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

/** Quantos aparelhos recebem push (01/11/2026). */
export const adminResumoPush = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).from("push_tokens").select("user_id,plataforma");
    if (error) return { aparelhos: 0, pessoas: 0, ios: 0, android: 0, tabelaFalta: true };
    const lista = (data ?? []) as { user_id: string; plataforma: string }[];
    return {
      aparelhos: lista.length,
      pessoas: new Set(lista.map((t) => t.user_id)).size,
      ios: lista.filter((t) => t.plataforma === "ios").length,
      android: lista.filter((t) => t.plataforma === "android").length,
      tabelaFalta: false,
    };
  });

/** Admin envia uma notificação para o celular de um usuário ou de todos os ativos. */
export const adminEnviarPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        alvo: z.union([z.literal("todos"), z.string().uuid()]),
        titulo: z.string().trim().min(2).max(80),
        corpo: z.string().trim().min(2).max(240),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    let ids: string[];
    if (data.alvo === "todos") {
      const { data: perfis } = await db.from("profiles").select("id").eq("ativo", true).limit(10000);
      ids = (perfis ?? []).map((p: any) => p.id);
    } else ids = [data.alvo];
    const { enviarPush } = await import("@/lib/push.server");
    const r = await enviarPush(db, ids, { titulo: data.titulo, corpo: data.corpo, destino: "/" });
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "push_enviado",
      detalhes: { alvo: data.alvo, titulo: data.titulo, enviados: r.enviados, falhas: r.falhas },
    });
    return r;
  });
