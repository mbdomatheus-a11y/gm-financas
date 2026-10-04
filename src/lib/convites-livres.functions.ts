import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verificarTurnstileToken } from "@/lib/turnstile.functions";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";
import { isValidCpf } from "@/lib/cpf";

const schemaCadastroLivre = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  turnstileToken: z.string().optional(),
  aceitouDocumentos: z.literal(true),
});

/**
 * Cria uma conta sem necessidade de código de convite.
 * Só funciona quando cadastro_livre_habilitado = true na tabela de configurações.
 */
export const criarContaSemConvite = createServerFn({ method: "POST" })
  .validator((raw: unknown) => schemaCadastroLivre.parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean; email: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // 1. Verificar se cadastro livre está habilitado
    const { data: conf } = await db
      .from("configuracoes_acesso_site")
      .select("cadastro_livre_habilitado")
      .eq("id", true)
      .maybeSingle();

    const cadastroLivre = conf?.cadastro_livre_habilitado ?? true;
    if (!cadastroLivre) {
      throw new Error("Cadastro sem convite não está habilitado no momento.");
    }

    // 2. Verificar Turnstile (se ativo)
    if (TURNSTILE_ATIVO) {
      const ok = await verificarTurnstileToken(data.turnstileToken ?? "");
      if (!ok) throw new Error("Verificação de segurança inválida.");
    }

    // 3. Validar CPF se fornecido
    if (data.cpf) {
      if (!isValidCpf(data.cpf)) throw new Error("CPF inválido.");
      const { data: existeCpf } = await db
        .from("profiles")
        .select("id")
        .eq("cpf", data.cpf)
        .limit(1)
        .single();
      if (existeCpf) throw new Error("Já existe uma conta com este CPF.");
    }

    // 4. Criar usuário no Supabase Auth
    const emailNorm = data.email.trim().toLowerCase();
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNorm,
      password: data.senha,
      email_confirm: true,
    });
    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? "Erro ao criar usuário.");
    }

    const userId = authUser.user.id;

    // 5. Criar grupo pessoal
    const nomeGrupo = `${data.nome.trim().split(" ")[0]}'s Group`;
    const { data: grupo, error: grupoErr } = await db
      .from("grupos")
      .insert({ nome: nomeGrupo, criado_por: userId })
      .select("id")
      .single();
    if (grupoErr || !grupo) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Erro ao criar grupo: " + grupoErr?.message);
    }

    // 6. Criar perfil
    const { error: perfilErr } = await db.from("profiles").insert({
      id: userId,
      nome: data.nome.trim(),
      email: emailNorm,
      cpf: data.cpf || null,
      telefone: data.telefone?.trim() || null,
      data_nascimento: data.dataNascimento || null,
      grupo_id: grupo.id,
    });
    if (perfilErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Erro ao criar perfil: " + perfilErr.message);
    }

    // 7. Criar papel de admin
    await db.from("user_roles").insert({ user_id: userId, role: "admin", grupo_id: grupo.id });

    // 8. Registrar aceite dos documentos
    await db.from("aceites_documentos").insert({
      user_id: userId,
      grupo_id: grupo.id,
      versao_termos: "1.0",
      versao_privacidade: "1.0",
    });

    return { ok: true, email: emailNorm };
  });
