import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/cpf";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const solicitarCodigoRecuperacao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ cpf: z.string().min(11).max(14), email: z.string().trim().email() }).parse(input),
  )
  .handler(async ({ data }) => {
    const cpf = onlyDigits(data.cpf);
    if (!isValidCpf(cpf)) throw new Error("CPF inválido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: arquivo } = await db
      .from("contas_excluidas")
      .select("id,email")
      .eq("cpf", cpf)
      .is("restaurada_em", null)
      .is("excluida_definitivamente_em", null)
      .gt("expira_em", new Date().toISOString())
      .order("excluida_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const resposta = { ok: true as const };
    if (!arquivo?.email || arquivo.email.toLowerCase() !== data.email.toLowerCase())
      return resposta;

    const { data: recentes } = await db
      .from("contas_recuperacao_codigos")
      .select("criado_em")
      .eq("conta_excluida_id", arquivo.id)
      .gte("criado_em", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("criado_em", { ascending: false });
    if (
      (recentes ?? []).length >= 3 ||
      (recentes?.[0] && Date.now() - new Date(recentes[0].criado_em).getTime() < 10 * 60 * 1000)
    )
      return resposta;

    const { randomBytes } = await import("node:crypto");
    const { hashCodigoRecuperacao } = await import("@/lib/conta-exclusao.server");
    const codigo = randomBytes(24).toString("base64url");
    const { data: token, error: tokenErro } = await db
      .from("contas_recuperacao_codigos")
      .insert({ conta_excluida_id: arquivo.id, token_hash: hashCodigoRecuperacao(codigo) })
      .select("id")
      .single();
    if (tokenErro) throw new Error("Não foi possível iniciar a recuperação.");
    const { enviarEmail } = await import("@/lib/email.server");
    const enviado = await enviarEmail({
      to: arquivo.email,
      subject: "Código para recuperar sua conta Control ALL",
      html: `<p>Use este código para confirmar a recuperação da sua conta:</p><p style="font-family:monospace;word-break:break-all"><strong>${codigo}</strong></p><p>Válido por 15 minutos. Se você não solicitou, ignore este e-mail.</p>`,
    });
    if (!enviado.ok) {
      await db.from("contas_recuperacao_codigos").delete().eq("id", token.id);
      throw new Error("Não foi possível enviar o código agora. Tente novamente mais tarde.");
    }
    return resposta;
  });

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
      .from("site_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (role) {
      throw new Error("Contas administrativas não podem ser excluídas por segurança.");
    }

    if (data.modo === "recuperavel") {
      const { arquivarEExcluirConta } = await import("@/lib/conta-exclusao.server");
      const accessToken = getRequest()
        .headers.get("authorization")
        ?.replace(/^Bearer\s+/i, "");
      await arquivarEExcluirConta({
        userId: context.userId,
        excluidaPor: context.userId,
        accessToken,
      });
    } else {
      throw new Error(
        "A exclusão definitiva exige uma limpeza completa de arquivos e dados do grupo. Use a opção recuperável por enquanto.",
      );
    }
    return { ok: true as const };
  });
