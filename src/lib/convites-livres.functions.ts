import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { menorDeIdade, metadadosAceite, MSG_MENOR_DE_IDADE } from "@/lib/termos-aceite";
import { isValidCpf } from "@/lib/cpf";

const schemaCadastroLivre = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  turnstileToken: z.string().optional(),
  codigoEmail: z.string().max(12).optional(),
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

    // 2. Turnstile agora é conferido ao enviar o código de e-mail (o token só vale uma vez).

    // Termos, item 4.2: só maiores de 18 anos.
    if (data.dataNascimento && menorDeIdade(new Date(data.dataNascimento))) {
      throw new Error(MSG_MENOR_DE_IDADE);
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

    // Revisão de segurança 24/10: só cria a conta com o código enviado ao e-mail (prova de dono).
    const { consumirCodigoVerificacao } = await import("@/lib/verificacao-email.server");
    await consumirCodigoVerificacao(db, { email: data.email, finalidade: "cadastro", codigo: data.codigoEmail });

    // 4. Criar usuário no Supabase Auth
    const emailNorm = data.email.trim().toLowerCase();
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNorm,
      password: data.senha,
      email_confirm: true,
      user_metadata: metadadosAceite(),
    });
    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? "Erro ao criar usuário.");
    }

    const userId = authUser.user.id;

    // 5. Criar grupo pessoal
    const nomeGrupo = `${data.nome.trim().split(" ")[0]}'s Group`;
    const { data: grupo, error: grupoErr } = await db
      .from("grupos")
      .insert({ nome: nomeGrupo, criado_por: userId, oracle_storage_cota_bytes: 536870912 })
      .select("id")
      .single();
    if (grupoErr || !grupo) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Erro ao criar grupo: " + grupoErr?.message);
    }

    // 6. Criar/atualizar perfil.
    // O gatilho `on_auth_user_created` (handle_new_user) JÁ cria uma linha em
    // `profiles` assim que o usuário de autenticação é criado; por isso aqui é
    // upsert (insert puro causava "duplicate key ... profiles_pkey").
    const cpfLimpo = data.cpf ? data.cpf.replace(/\D/g, "") : "";
    const { error: perfilErr } = await db.from("profiles").upsert(
      {
        id: userId,
        nome: data.nome.trim(),
        email: emailNorm,
        cpf: cpfLimpo || null,
        telefone: data.telefone?.trim() || null,
        data_nascimento: data.dataNascimento || null,
        grupo_id: grupo.id,
        ativo: true,
        senha_temporaria: false,
      },
      { onConflict: "id" },
    );
    if (perfilErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await db.from("grupos").delete().eq("id", grupo.id);
      throw new Error("Erro ao criar perfil: " + perfilErr.message);
    }

    // 7. Papel de admin do próprio grupo (tabela user_roles não tem grupo_id).
    const { error: roleErr } = await db
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await db.from("grupos").delete().eq("id", grupo.id);
      throw new Error("Erro ao definir permissões: " + roleErr.message);
    }

    // 8. Registrar aceite dos documentos (colunas reais: documento e versao).
    const { error: aceiteErr } = await db.from("aceites_documentos").upsert(
      [
        { user_id: userId, documento: "termos_uso", versao: "2026-09-19" },
        { user_id: userId, documento: "aviso_privacidade", versao: "2026-09-19" },
      ],
      { onConflict: "user_id,documento,versao" },
    );
    if (aceiteErr) {
      // Não bloqueia o cadastro, mas fica registrado no log do servidor.
      console.error("Falha ao registrar aceite de documentos:", aceiteErr.message);
    }

    return { ok: true, email: emailNorm };
  });
