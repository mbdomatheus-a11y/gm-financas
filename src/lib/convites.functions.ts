import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { verificarTurnstileToken } from "@/lib/turnstile.functions";

/** Máximo de convites (aceitos + pendentes não expirados) por pessoa. */
const COTA_CONVITES = 3;

/**
 * Cria um convite pro grupo do usuário logado, respeitando a cota de
 * COTA_CONVITES por pessoa (convites aceitos + ainda pendentes contam).
 * Usa o cliente service-role só porque `convites`/contagem cruzada de
 * `profiles.convidado_por` precisa enxergar mais do que a policy padrão de
 * "próprio perfil" permitiria a um usuário comum — nunca expõe dado de
 * fora do necessário pra essa contagem.
 */
export const criarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const meuId = context.userId;

    const [aceitosRes, pendentesRes] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }).eq("convidado_por", meuId),
      db
        .from("convites")
        .select("id", { count: "exact", head: true })
        .eq("criado_por", meuId)
        .eq("usado", false)
        .gt("expira_em", new Date().toISOString()),
    ]);
    if (aceitosRes.error) throw new Error(aceitosRes.error.message);
    if (pendentesRes.error) throw new Error(pendentesRes.error.message);

    const usados = (aceitosRes.count ?? 0) + (pendentesRes.count ?? 0);
    if (usados >= COTA_CONVITES) {
      throw new Error(`Você já atingiu o limite de ${COTA_CONVITES} convites.`);
    }

    const { data: perfil, error: perfilError } = await db
      .from("profiles")
      .select("grupo_id")
      .eq("id", meuId)
      .maybeSingle();
    if (perfilError) throw new Error(perfilError.message);
    if (!perfil?.grupo_id) throw new Error("Não foi possível identificar o seu grupo.");

    const { data: convite, error } = await db
      .from("convites")
      .insert({ grupo_id: perfil.grupo_id, criado_por: meuId })
      .select("id, token, criado_em, expira_em")
      .single();
    if (error) throw new Error(error.message);
    return convite as { id: string; token: string; criado_em: string; expira_em: string };
  });

/** Lista os convites já criados pelo usuário logado (pendentes e usados). */
export const listarMeusConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
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
        turnstileToken: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const turnstileOk = await verificarTurnstileToken(data.turnstileToken);
    if (!turnstileOk)
      throw new Error("Verificação de segurança falhou. Recarregue e tente de novo.");
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

    const { error: profileError } = await db.from("profiles").insert({
      id: created.user.id,
      nome: data.nome,
      cpf: onlyDigits(data.cpf),
      email: data.email,
      telefone: data.telefone,
      data_nascimento: data.dataNascimento,
      grupo_id: convite.grupo_id,
      convidado_por: convite.criado_por,
      ativo: true,
      senha_temporaria: false,
    });
    if (profileError) {
      // Evita deixar um usuário de auth órfão (sem perfil) se o insert falhar.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    await db
      .from("convites")
      .update({ usado: true, usado_por: created.user.id })
      .eq("id", convite.id);

    return { ok: true, email: data.email };
  });
