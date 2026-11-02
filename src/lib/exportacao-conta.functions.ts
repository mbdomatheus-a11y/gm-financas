import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** O próprio usuário baixa todos os seus dados em JSON. */
export const exportarMinhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { montarExportacaoConta } = await import("@/lib/exportacao-conta.server");
    // Retorno serializável para o cliente (JSON da conta).
    return (await montarExportacaoConta(supabaseAdmin as any, context.userId)) as Record<string, any>;
  });

/**
 * Encerramento: a administração gera o JSON da conta do chamado e envia para o e-mail solicitado.
 * O arquivo nunca é devolvido à tela do admin; só vai como anexo para o destinatário.
 */
export const adminEnviarExportacaoEncerramento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ chamadoId: z.string().uuid(), email: z.string().email().max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: adm } = await db.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!adm) throw new Error("Só a administração do site pode enviar esta exportação.");
    const { data: chamado } = await db
      .from("chamados_suporte")
      .select("id,user_id,protocolo,assunto")
      .eq("id", data.chamadoId)
      .maybeSingle();
    if (!chamado?.user_id) throw new Error("Chamado sem conta vinculada.");

    const { montarExportacaoConta } = await import("@/lib/exportacao-conta.server");
    const exportacao = await montarExportacaoConta(db, chamado.user_id as string);
    const conteudo = Buffer.from(JSON.stringify(exportacao, null, 2), "utf-8").toString("base64");
    const nomeArquivo = `controlall-dados-${String(chamado.protocolo ?? chamado.id).slice(0, 8)}.json`;

    const { enviarEmail } = await import("@/lib/email.server");
    const envio = await enviarEmail({
      to: data.email,
      subject: "Seus dados do Control ALL",
      html: `<p>Olá,</p><p>Segue em anexo a exportação dos dados da sua conta do Control ALL, em formato JSON (${nomeArquivo}).</p><p>Se tiver dúvidas sobre o arquivo, responda este e-mail ou escreva para privacidade@controlall.com.br.</p><p>Equipe Control ALL</p>`,
      anexos: [{ filename: nomeArquivo, content: conteudo }],
    });
    if (!envio.ok) throw new Error(envio.erro);

    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "exportacao_dados_enviada",
      alvo_id: chamado.user_id,
      detalhes: { chamado_id: chamado.id, protocolo: chamado.protocolo ?? null },
    });
    return { ok: true as const };
  });
