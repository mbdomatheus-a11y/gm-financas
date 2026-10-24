import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verificarTurnstileToken } from "@/lib/turnstile.functions";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";

/**
 * Cadastro (público): envia o código de confirmação para o e-mail informado.
 * A verificação anti-robô (Turnstile) acontece aqui, no passo que dispara e-mail;
 * a criação da conta depois exige o código.
 */
export const enviarCodigoCadastro = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email("E-mail inválido").max(254),
        turnstileToken: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (TURNSTILE_ATIVO) {
      const ok = await verificarTurnstileToken(data.turnstileToken ?? "");
      if (!ok) throw new Error("Verificação de segurança falhou. Recarregue e tente de novo.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { aplicarLimite, aplicarLimitePorIp } = await import("@/lib/rate-limit.server");
    const { enviarCodigoVerificacao, mascararEmail, normalizarEmail } = await import(
      "@/lib/verificacao-email.server"
    );
    const email = normalizarEmail(data.email);
    await aplicarLimitePorIp(db, "codigo-cadastro", 10, 60);
    await aplicarLimite(db, { rota: "codigo-cadastro-email", chave: email, maxPorJanela: 5, janelaMinutos: 60 });
    await enviarCodigoVerificacao(db, { email, finalidade: "cadastro" });
    return { ok: true as const, emailMascarado: mascararEmail(email) };
  });

/** Troca de e-mail (logado): envia o código para o NOVO e-mail. */
export const enviarCodigoTrocaEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().email("E-mail inválido").max(254) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { aplicarLimite } = await import("@/lib/rate-limit.server");
    const { enviarCodigoVerificacao, mascararEmail, normalizarEmail } = await import(
      "@/lib/verificacao-email.server"
    );
    const email = normalizarEmail(data.email);
    const { data: atual } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (atual.user?.email?.toLowerCase() === email) throw new Error("Este já é o seu e-mail.");
    await aplicarLimite(db, {
      rota: "codigo-troca-email",
      chave: context.userId,
      maxPorJanela: 5,
      janelaMinutos: 60,
    });
    await enviarCodigoVerificacao(db, { email, finalidade: "troca_email", userId: context.userId });
    return { ok: true as const, emailMascarado: mascararEmail(email) };
  });
