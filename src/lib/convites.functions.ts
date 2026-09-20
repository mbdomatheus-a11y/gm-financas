import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { verificarTurnstileToken } from "@/lib/turnstile.functions";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";

/** Máximo de convites (aceitos + pendentes não expirados) por pessoa. */
const COTA_CONVITES = 3;

/**
 * Cria um convite pro grupo do usuário logado, respeitando a cota de
 * COTA_CONVITES por pessoa. Convites usados e pendentes não expirados contam.
 * A consulta usa a sessão validada e as políticas da própria tabela.
 */
export const criarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const meuId = context.userId;

    const { data: convites, error: convitesError } = await context.supabase
      .from("convites")
      .select("usado, expira_em")
      .eq("criado_por", meuId);
    if (convitesError) throw new Error(convitesError.message);

    const agora = Date.now();
    const usados = (convites ?? []).filter(
      (convite) => convite.usado || new Date(convite.expira_em).getTime() >= agora,
    ).length;
    if (usados >= COTA_CONVITES) {
      throw new Error(`Você já atingiu o limite de ${COTA_CONVITES} convites.`);
    }

    const { data: perfil, error: perfilError } = await context.supabase
      .from("profiles")
      .select("grupo_id")
      .eq("id", meuId)
      .maybeSingle();
    if (perfilError) throw new Error(perfilError.message);
    if (!perfil?.grupo_id) throw new Error("Não foi possível identificar o seu grupo.");

    const { data: convite, error } = await context.supabase
      .from("convites")
      .insert({ grupo_id: perfil.grupo_id, criado_por: meuId })
      .select("id, token, criado_em, expira_em")
      .single();
    if (error) throw new Error(error.message);
    return convite as { id: string; token: string; criado_em: string; expira_em: string };
  });

/** Envia um convite já existente (pendente, não usado, não expirado) por e-mail via Resend. */
export const enviarConvitePorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        conviteId: z.string().uuid(),
        email: z.string().trim().email("E-mail inválido"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: convite, error } = await context.supabase
      .from("convites")
      .select("token, usado, expira_em, criado_por")
      .eq("id", data.conviteId)
      .eq("criado_por", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!convite) throw new Error("Convite não encontrado.");
    if (convite.usado) throw new Error("Este convite já foi usado.");
    if (new Date(convite.expira_em).getTime() < Date.now()) {
      throw new Error("Este convite expirou. Gere um novo.");
    }

    const { enviarEmail } = await import("@/lib/email.server");
    const resultado = await enviarEmail({
      to: data.email,
      subject: "Você foi convidado para o Control ALL",
      html: `
        <p>Você recebeu um convite para criar sua conta no <strong>Control ALL</strong>.</p>
        <p>Código de convite:</p>
        <p style="font-family:monospace;font-size:18px;letter-spacing:1px">${convite.token}</p>
        <p>Acesse o site, na aba "Criar conta", e cole esse código no campo de convite.</p>
        <p style="color:#888;font-size:12px">Se você não esperava este e-mail, pode ignorá-lo.</p>
      `,
    });
    if (!resultado.ok) throw new Error(resultado.erro);
    return { ok: true as const };
  });

/**
 * Cancela um convite próprio ainda não usado (RLS de `convites` já restringe
 * a `criado_por = auth.uid()` — não precisa checar dono na mão aqui). Um
 * convite usado não pode ser cancelado, a conta já existe.
 */
export const cancelarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: convite, error } = await context.supabase
      .from("convites")
      .select("usado")
      .eq("id", data.conviteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!convite) throw new Error("Convite não encontrado.");
    if (convite.usado) throw new Error("Este convite já foi usado — não é possível cancelar.");

    const { error: delError } = await context.supabase
      .from("convites")
      .delete()
      .eq("id", data.conviteId);
    if (delError) throw new Error(delError.message);
    return { ok: true as const };
  });

/** Lista os convites já criados pelo usuário logado (pendentes e usados). */
export const listarMeusConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("convites")
      .select("id, token, usado, usado_por, criado_em, expira_em")
      .eq("criado_por", context.userId)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      token: string;
      usado: boolean;
      usado_por: string | null;
      criado_em: string;
      expira_em: string;
    }[];
  });

/**
 * Cadastro por convite — endpoint PÚBLICO (sem sessão, o usuário ainda não
 * existe). A verificação do Turnstile faz o papel que a autenticação faria
 * aqui, barrando automação/spam nesse endpoint aberto.
 */
export const aceitarConvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        nome: z.string().trim().min(2).max(120),
        cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
        email: z.string().trim().email("E-mail inválido"),
        telefone: z.string().trim().min(8).max(20),
        dataNascimento: z.string().min(10),
        senha: z.string().min(8).max(72),
        turnstileToken: z.string().optional(),
        recuperarDados: z.boolean().optional(),
        codigoRecuperacao: z.string().min(20).max(100).optional(),
        aceitouDocumentos: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!isValidCpf(data.cpf)) throw new Error("CPF inválido");

    const nascimento = new Date(data.dataNascimento);
    if (Number.isNaN(nascimento.getTime()) || nascimento > new Date()) {
      throw new Error("Data de nascimento inválida");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: convite, error: convError } = await db
      .from("convites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (convError) throw new Error(convError.message);
    if (!convite) throw new Error("Convite não encontrado. Peça um novo link.");
    if (convite.usado) throw new Error("Este convite já foi usado.");
    if (new Date(convite.expira_em).getTime() < Date.now()) {
      throw new Error("Este convite expirou. Peça um novo link.");
    }

    const { data: contaArquivada, error: archiveError } = await db
      .from("contas_excluidas")
      .select("id, grupo_id, expira_em, email, auth_user_id_original")
      .eq("cpf", onlyDigits(data.cpf))
      .is("restaurada_em", null)
      .is("excluida_definitivamente_em", null)
      .gt("expira_em", new Date().toISOString())
      .order("excluida_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (archiveError) throw new Error(archiveError.message);
    if (contaArquivada && data.recuperarDados === undefined) {
      throw new Error("RECUPERACAO_DISPONIVEL");
    }
    if (TURNSTILE_ATIVO) {
      const turnstileOk = await verificarTurnstileToken(data.turnstileToken ?? "");
      if (!turnstileOk)
        throw new Error("Verificação de segurança falhou. Recarregue e tente de novo.");
    }
    if (contaArquivada && data.recuperarDados) {
      if (
        contaArquivada.email?.toLowerCase() !== data.email.toLowerCase() ||
        !data.codigoRecuperacao
      )
        throw new Error("A recuperação exige confirmação pelo e-mail anterior.");
      const { validarCodigoRecuperacao } = await import("@/lib/conta-exclusao.server");
      const codigoId = await validarCodigoRecuperacao(contaArquivada.id, data.codigoRecuperacao);
      const { data: usuarioAntigo, error: buscaErro } = await supabaseAdmin.auth.admin.getUserById(
        contaArquivada.auth_user_id_original,
      );
      if (buscaErro || !usuarioAntigo.user)
        throw new Error(
          "Esta exclusão antiga não permite recuperação integral. Crie uma conta nova sem recuperar.",
        );
      const { error: reativarErro } = await supabaseAdmin.auth.admin.updateUserById(
        usuarioAntigo.user.id,
        { email: data.email, password: data.senha, ban_duration: "none", email_confirm: true },
      );
      if (reativarErro) throw new Error("Não foi possível reativar a conta. Tente novamente.");
      const { error: perfilErro } = await db
        .from("profiles")
        .update({
          nome: data.nome,
          cpf: onlyDigits(data.cpf),
          email: data.email,
          telefone: data.telefone,
          data_nascimento: data.dataNascimento,
          grupo_id: contaArquivada.grupo_id,
          ativo: true,
          senha_temporaria: false,
        })
        .eq("id", usuarioAntigo.user.id);
      if (perfilErro) {
        await supabaseAdmin.auth.admin.updateUserById(usuarioAntigo.user.id, {
          email: `excluida-${usuarioAntigo.user.id}@conta.invalid`,
          ban_duration: "876000h",
        });
        throw new Error("Não foi possível concluir a recuperação sem risco aos dados.");
      }
      const { error: restaurarErro } = await db
        .from("contas_excluidas")
        .update({ restaurada_em: new Date().toISOString() })
        .eq("id", contaArquivada.id);
      if (restaurarErro)
        throw new Error(
          "A conta foi reativada, mas o histórico de recuperação precisa de revisão administrativa.",
        );
      await db
        .from("convites")
        .update({ usado: true, usado_por: usuarioAntigo.user.id })
        .eq("id", convite.id);
      await db.from("aceites_documentos").upsert(
        [
          { user_id: usuarioAntigo.user.id, documento: "termos_uso", versao: "2026-09-19" },
          { user_id: usuarioAntigo.user.id, documento: "aviso_privacidade", versao: "2026-09-19" },
        ],
        { onConflict: "user_id,documento,versao" },
      );
      await db.from("contas_recuperacao_codigos").delete().eq("id", codigoId);
      return { ok: true, email: data.email };
    }

    // Cada convidado entra num grupo NOVO e isolado — não no grupo de quem
    // convidou. O convite libera a conta (é o "selo" de confiança), mas os
    // dados de cada pessoa/casal ficam separados dos de quem os convidou.
    // Bug corrigido em 2026-09-18: antes o código reaproveitava
    // `convite.grupo_id` (o grupo de quem gerou o convite), então todo
    // convidado passava a enxergar os dados financeiros de quem o convidou.
    let grupoId = null;
    if (!grupoId) {
      const { data: grupoNovo, error: grupoError } = await db
        .from("grupos")
        .insert({ nome: `Grupo de ${data.nome.trim()}` })
        .select("id")
        .single();
      if (grupoError) throw new Error(grupoError.message);
      grupoId = grupoNovo.id;
    }

    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (authError || !created.user) {
      throw new Error(
        authError?.message ?? "Não foi possível criar a conta. O e-mail já está em uso?",
      );
    }

    // upsert (não insert): um trigger `handle_new_user` já cria uma linha
    // mínima em `profiles` ao inserir em `auth.users` — precisamos
    // sobrescrever com os dados completos do convite, não colidir com ela.
    const { error: profileError } = await db.from("profiles").upsert(
      {
        id: created.user.id,
        nome: data.nome,
        cpf: onlyDigits(data.cpf),
        email: data.email,
        telefone: data.telefone,
        data_nascimento: data.dataNascimento,
        grupo_id: grupoId,
        convidado_por: convite.criado_por,
        ativo: true,
        senha_temporaria: false,
      },
      { onConflict: "id" },
    );
    if (profileError) {
      // Evita deixar um usuário de auth órfão (sem perfil) se o insert falhar.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    // O convidado é o único membro do próprio grupo novo — precisa ser admin
    // dele pra gerenciar o próprio grupo (convidar mais gente, permissões).
    const { error: roleError } = await db
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleError.message);
    }

    await db
      .from("convites")
      .update({ usado: true, usado_por: created.user.id })
      .eq("id", convite.id);

    await db.from("aceites_documentos").insert([
      { user_id: created.user.id, documento: "termos_uso", versao: "2026-09-19" },
      { user_id: created.user.id, documento: "aviso_privacidade", versao: "2026-09-19" },
    ]);

    return { ok: true, email: data.email };
  });
