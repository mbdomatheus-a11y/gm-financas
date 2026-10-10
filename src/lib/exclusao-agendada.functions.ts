import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Carência, em dias, entre marcar a exclusão e a remoção definitiva. */
export const DIAS_CARENCIA_EXCLUSAO = 90;

/**
 * Admin principal marca a conta de um usuário comum para exclusão. A conta
 * continua acessível por 90 dias; o usuário vê o aviso com o tempo restante e
 * decide, a cada login, se cancela a exclusão. Passado o prazo, o cron diário
 * remove a conta e os dados.
 */
export const adminAgendarExclusaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        confirmacao1: z.literal("DELETAR"),
        confirmacao2: z.literal("Confirmo Delete"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ehAdminPrincipal } = await import("@/lib/conta-exclusao.server");
    if (!(await ehAdminPrincipal(context.userId))) {
      throw new Error("Somente o administrador principal pode excluir usuários.");
    }
    if (data.userId === context.userId || (await ehAdminPrincipal(data.userId))) {
      throw new Error("Contas administrativas não podem ser excluídas.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: alvo } = await db
      .from("profiles")
      .select("id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!alvo) throw new Error("Usuário não encontrado.");
    const agora = new Date();
    const prevista = new Date(agora.getTime() + DIAS_CARENCIA_EXCLUSAO * 86400000);
    const { error } = await db.from("exclusoes_agendadas").upsert(
      {
        user_id: data.userId,
        agendada_em: agora.toISOString(),
        prevista_em: prevista.toISOString(),
        agendada_por: context.userId,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("Não foi possível agendar a exclusão.");
    await db.from("admin_audit_logs").insert({
      acao: "exclusao_conta_agendada",
      alvo_id: data.userId,
      detalhes: { prevista_em: prevista.toISOString() },
    });
    return { ok: true as const, previstaEm: prevista.toISOString() };
  });

/** Admin principal cancela uma exclusão agendada. */
export const adminCancelarExclusaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ehAdminPrincipal } = await import("@/lib/conta-exclusao.server");
    if (!(await ehAdminPrincipal(context.userId))) {
      throw new Error("Somente o administrador principal pode cancelar uma exclusão.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("exclusoes_agendadas").delete().eq("user_id", data.userId);
    if (error) throw new Error("Não foi possível cancelar a exclusão.");
    await db.from("admin_audit_logs").insert({
      acao: "exclusao_conta_cancelada_pelo_admin",
      alvo_id: data.userId,
      detalhes: {},
    });
    return { ok: true as const };
  });

/** Exclusão agendada da conta de quem está logado (ou null). */
export const minhaExclusaoAgendada = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("exclusoes_agendadas")
      .select("agendada_em,prevista_em")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return null;
    return { agendadaEm: data.agendada_em as string, previstaEm: data.prevista_em as string };
  });

/** O próprio usuário responde "sim" ao aviso e a conta é restaurada. */
export const cancelarMinhaExclusao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("exclusoes_agendadas").delete().eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível cancelar a exclusão.");
    await db.from("admin_audit_logs").insert({
      acao: "exclusao_conta_cancelada_pelo_usuario",
      alvo_id: context.userId,
      detalhes: {},
    });
    return { ok: true as const };
  });
