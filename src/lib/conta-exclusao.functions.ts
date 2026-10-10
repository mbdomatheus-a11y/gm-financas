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
      // 2026-10-10: antes a conta era banida e o e-mail trocado por um
      // temporário. Quem entrava pelo Google voltava a cair nesse mesmo
      // usuário banido e recebia "User is banned", sem conseguir nem entrar
      // nem criar conta nova com o mesmo e-mail. Agora a exclusão do próprio
      // usuário usa a mesma carência de 90 dias da exclusão feita pelo
      // administrador: o acesso continua, e a cada login o aviso pergunta se
      // ele quer cancelar (ExclusaoAgendadaModal). Passados os 90 dias, o
      // cron diário apaga a conta de verdade.
      const { DIAS_CARENCIA_EXCLUSAO } = await import("@/lib/exclusao-agendada.functions");
      const agora = new Date();
      const prevista = new Date(agora.getTime() + DIAS_CARENCIA_EXCLUSAO * 86400000);
      const { error } = await db.from("exclusoes_agendadas").upsert(
        {
          user_id: context.userId,
          agendada_em: agora.toISOString(),
          prevista_em: prevista.toISOString(),
          agendada_por: context.userId,
        },
        { onConflict: "user_id" },
      );
      if (error) throw new Error("Não foi possível agendar a exclusão da conta.");
      await db.from("admin_audit_logs").insert({
        acao: "exclusao_conta_agendada_pelo_usuario",
        alvo_id: context.userId,
        detalhes: { prevista_em: prevista.toISOString() },
      });
      const accessToken = getRequest()
        .headers.get("authorization")
        ?.replace(/^Bearer\s+/i, "");
      if (accessToken) {
        const { error: sairErro } = await supabaseAdmin.auth.admin.signOut(accessToken, "global");
        if (sairErro) console.error("[conta] Falha ao encerrar sessões:", sairErro.message);
      }
      return { ok: true as const, previstaEm: prevista.toISOString() };
    } else {
      throw new Error(
        "A exclusão definitiva exige uma limpeza completa de arquivos e dados do grupo. Use a opção recuperável por enquanto.",
      );
    }
    return { ok: true as const };
  });
