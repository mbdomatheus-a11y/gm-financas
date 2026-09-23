import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { CPF_EMAIL_DOMAIN } from "@/lib/cpf";

/** Quanto tempo o link de redefinição vale, depois disso precisa pedir outro. */
const EXPIRACAO_MINUTOS = 30;

function gerarToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** URL base do site pra montar o link do e-mail. Configure SITE_URL na Vercel
 * quando trocar de domínio — sem isso cai no domínio padrão da Vercel. */
function urlBase(): string {
  return process.env["SITE_URL"] || "https://gm-financas-ohdi.vercel.app";
}

/**
 * Pede o link de redefinição de senha por e-mail — endpoint PÚBLICO (o
 * usuário ainda não está logado, por definição).
 *
 * Sempre retorna `{ ok: true }`, exista ou não o e-mail, pra não revelar se
 * uma conta existe (evita enumeração). Contas antigas criadas por CPF usam
 * um e-mail sintético (`@financascasal.app`, ver src/lib/cpf.ts) que ninguém
 * lê de verdade — pra essas, não tem o que enviar, mesma resposta genérica.
 */
export const solicitarRecuperacaoSenha = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email() }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (email.endsWith(`@${CPF_EMAIL_DOMAIN}`)) {
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lista, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    const usuario = lista.users.find((u) => u.email?.toLowerCase() === email);
    if (!usuario) return { ok: true as const };

    const token = gerarToken();
    const { error: insertError } = await supabaseAdmin.from("password_reset_tokens").insert({
      user_id: usuario.id,
      token_hash: hashToken(token),
      expira_em: new Date(Date.now() + EXPIRACAO_MINUTOS * 60_000).toISOString(),
    });
    if (insertError) throw new Error(insertError.message);

    const link = `${urlBase()}/redefinir-senha?token=${token}`;
    const { enviarEmail } = await import("@/lib/email.server");
    await enviarEmail({
      to: usuario.email!,
      subject: "Redefinição de senha — Control ALL",
      html: `
        <p>Recebemos um pedido para redefinir a senha da sua conta no <strong>Control ALL</strong>.</p>
        <p><a href="${link}">Clique aqui para criar uma nova senha</a></p>
        <p style="color:#888;font-size:12px">
          Esse link expira em ${EXPIRACAO_MINUTOS} minutos. Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.
        </p>
      `,
    });

    return { ok: true as const };
  });

/**
 * Confirma a redefinição usando o token recebido por e-mail — endpoint
 * PÚBLICO. Token é validado por hash (nunca fica em texto puro no banco),
 * checa expiração e uso único.
 */
export const redefinirSenhaComToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(20),
        novaSenha: z.string().min(8).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = hashToken(data.token);

    const { data: registro, error } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id, user_id, expira_em, usado")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!registro || registro.usado) {
      throw new Error("Este link é inválido ou já foi usado. Peça um novo.");
    }
    if (new Date(registro.expira_em).getTime() < Date.now()) {
      throw new Error("Este link expirou. Peça um novo.");
    }

    const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(registro.user_id, {
      password: data.novaSenha,
    });
    if (updError) throw new Error(updError.message);

    await supabaseAdmin.from("password_reset_tokens").update({ usado: true }).eq("id", registro.id);
    await supabaseAdmin
      .from("profiles")
      .update({ senha_temporaria: false })
      .eq("id", registro.user_id);

    const { notificarSenhaAlterada } = await import("@/lib/seguranca-conta.functions");
    await notificarSenhaAlterada(registro.user_id);

    return { ok: true as const };
  });
