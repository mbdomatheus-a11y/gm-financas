import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Respostas do usuário que alimentam a gamificação financeira (Início):
 * renda líquida mensal, horas trabalhadas no mês e compromissos fixos.
 * Grava SEMPRE no perfil do próprio usuário autenticado (context.userId),
 * nunca em perfil informado pelo cliente.
 */
export const salvarPerfilFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        rendaLiquida: z.number().min(0).max(10_000_000),
        horasMes: z.number().int().min(1).max(720),
        compromissosFixos: z.number().min(0).max(10_000_000).nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({
        renda_liquida_informada: data.rendaLiquida,
        horas_trabalho_mes: data.horasMes,
        compromissos_fixos_informados: data.compromissosFixos ?? null,
        perfil_financeiro_respondido_em: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Item 12 (2026-10-05): registra que o usuário escolheu "não responder" na
 * tela cheia da Lista de compras (grava só no próprio perfil). */
export const pularPerfilFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ perfil_financeiro_pulado_em: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
