import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const excluirMinhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        modo: z.enum(["recuperavel", "definitiva"]),
        confirmacao1: z.literal("DELETAR"),
        confirmacao2: z.literal("Confirmo Delete"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: role } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (role) {
      throw new Error("Contas administrativas não podem ser excluídas por segurança.");
    }

    if (data.modo === "recuperavel") {
      const { arquivarEExcluirConta } = await import("@/lib/conta-exclusao.server");
      await arquivarEExcluirConta({ userId: context.userId, excluidaPor: context.userId });
    } else {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId, false);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });
