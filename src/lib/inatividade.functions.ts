import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const obterTempoInatividade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("configuracoes_site")
      .select("valor_inteiro")
      .eq("chave", "inatividade_minutos")
      .maybeSingle();
    return { minutos: typeof data?.valor_inteiro === "number" ? data.valor_inteiro : 5 };
  });

export const definirTempoInatividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ minutos: z.number().int().min(2).max(120) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const { data: admin, error: adminError } = await (context.supabase as any)
      .from("site_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (adminError || !admin) throw new Error("Apenas a administração pode alterar este prazo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("configuracoes_site").upsert({
      chave: "inatividade_minutos",
      valor_inteiro: data.minutos,
      atualizado_em: new Date().toISOString(),
    });
    if (error) throw error;
    return { minutos: data.minutos };
  });
