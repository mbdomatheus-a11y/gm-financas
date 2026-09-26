import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Chave usada em `configuracoes_casal` (mesmo padrão de `drive.functions.ts`). */
const CHAVE_MODO = (grupoId: string) => `${grupoId}:conciliacao_faturas_modo`;

/**
 * Item 12 do backlog do proprietário: cada grupo escolhe se parcelas
 * vencidas são consideradas pagas automaticamente após um prazo, ou se
 * prefere marcar manualmente (padrão). O modo automático só vale pra
 * parcelas que vencerem A PARTIR de quando o modo foi ativado — não marca
 * retroativamente nada que já estava vencido antes da troca.
 */
export const obterConciliacaoFaturas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: perfil, error: perfilError } = await context.supabase
      .from("profiles")
      .select("grupo_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (perfilError || !perfil?.grupo_id) throw new Error("Grupo do usuário não encontrado.");
    const grupoId: string = perfil.grupo_id;
    const chave = CHAVE_MODO(grupoId);
    const { data, error } = await context.supabase
      .from("configuracoes_casal")
      .select("chave,valor")
      .eq("grupo_id", grupoId)
      .in("chave", [chave]);
    if (error) throw error;
    const modo = data?.find((x) => x.chave === chave)?.valor ?? "manual";
    return { modo: modo === "automatico" ? "automatico" : "manual" } as {
      modo: "manual" | "automatico";
    };
  });

export const salvarConciliacaoFaturas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { modo: "manual" | "automatico" }) =>
    z.object({ modo: z.enum(["manual", "automatico"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: perfil, error: perfilError } = await context.supabase
      .from("profiles")
      .select("grupo_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (perfilError || !perfil?.grupo_id) throw new Error("Grupo do usuário não encontrado.");
    const grupoId: string = perfil.grupo_id;
    const chave = CHAVE_MODO(grupoId);
    if (data.modo === "manual") {
      // Ativar o modo manual só apaga a preferência — não desfaz nenhuma
      // parcela já marcada como paga automaticamente antes.
      const { error } = await context.supabase
        .from("configuracoes_casal")
        .delete()
        .eq("grupo_id", grupoId)
        .eq("chave", chave);
      if (error) throw error;
      return { modo: "manual" as const };
    }
    const { error } = await context.supabase.from("configuracoes_casal").upsert(
      {
        chave,
        valor: "automatico",
        grupo_id: grupoId,
        // Guarda a partir de quando o modo foi ativado — o cron só marca
        // como pagas parcelas vencidas DEPOIS desse instante, nunca as que
        // já estavam vencidas antes (não é retroativo).
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chave" },
    );
    if (error) throw error;
    return { modo: "automatico" as const };
  });
