import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enviarEmail } from "@/lib/email.server";

export const prepararEnvioLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        nome: z.string().min(1).max(180),
        banco: z.string().max(80).optional(),
        cartao: z.string().max(4).optional(),
        descricao: z.string().max(1000).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: perfil } = await db
      .from("profiles")
      .select("grupo_id, nome, email")
      .eq("id", context.userId)
      .single();

    const path = `${context.userId}/${crypto.randomUUID()}-${data.nome.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: url, error } = await db.storage.from("layouts_analise").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);

    const { data: item, error: insertError } = await db
      .from("layout_solicitacoes")
      .insert({
        user_id: context.userId,
        grupo_id: perfil?.grupo_id,
        arquivo_nome: data.nome,
        arquivo_path: path,
        banco_informado: data.banco || null,
        cartao_final: data.cartao || null,
        descricao: data.descricao || null,
        status: "recebida",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    // Notificar administradores via e-mail e notificação do sistema
    try {
      const { data: admins } = await db
        .from("site_admins")
        .select("user_id, profiles:user_id(email, nome)");

      const adminEmails = (admins ?? [])
        .map((a: any) => a.profiles?.email)
        .filter(Boolean);

      const nomeUsuario = perfil?.nome || perfil?.email || "Usuário";
      const assunto = `[Control ALL] Nova Fatura Enviada para Modelagem: ${data.nome}`;
      const corpoHtml = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Nova solicitação de modelagem de fatura</h2>
          <p><b>Usuário:</b> ${nomeUsuario}</p>
          <p><b>Arquivo:</b> ${data.nome}</p>
          <p><b>Banco:</b> ${data.banco || "Não informado"}</p>
          <p><b>Final do Cartão:</b> ${data.cartao || "Não informado"}</p>
          <p><b>Observação:</b> ${data.descricao || "Nenhuma"}</p>
          <hr />
          <p>Acesse o painel de <b>Administração</b> para baixar a fatura e atualizar o status.</p>
        </div>
      `;

      for (const email of adminEmails) {
        await enviarEmail({ to: email, subject: assunto, html: corpoHtml });
      }

      // Inserir registros na tabela de notificações de usuários para cada admin
      for (const adminItem of admins ?? []) {
        await db.from("notificacoes_usuario").insert({
          user_id: adminItem.user_id,
          tipo: "layout_pendente",
          titulo: "Nova fatura enviada para modelagem",
          mensagem: `${nomeUsuario} enviou a fatura "${data.nome}" (${data.banco || "Banco não inf."}) para análise.`,
          referencia_tipo: "layout",
        });
      }
    } catch (err) {
      console.error("Erro ao enviar notificação de layout para admin:", err);
    }

    return { path, token: url.token, id: item.id };
  });

export const excluirSolicitacaoLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: item, error: buscarError } = await db
      .from("layout_solicitacoes")
      .select("user_id, arquivo_path, status")
      .eq("id", data.id)
      .single();

    if (buscarError || !item) throw new Error("Solicitação não encontrada.");
    if (item.user_id !== context.userId) {
      throw new Error("Você só pode excluir faturas que você mesmo enviou.");
    }

    // Remover do storage se o arquivo ainda existir
    if (item.arquivo_path) {
      await db.storage.from("layouts_analise").remove([item.arquivo_path]);
    }

    const { error } = await db.from("layout_solicitacoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

export const listarMinhasSolicitacoesLayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data, error } = await db
      .from("layout_solicitacoes")
      .select("id, arquivo_nome, banco_informado, cartao_final, status, resposta_admin, criado_em")
      .eq("user_id", context.userId)
      .order("criado_em", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });
