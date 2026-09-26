import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maskCpfPrivate } from "@/lib/cpf";

const DOMAIN = "financascasal.app";

/** Gera uma senha provisória aleatória (mostrada uma única vez ao administrador). */
function gerarSenhaTemporaria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: siteAdmin, error: adminError } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (adminError || !siteAdmin) throw new Error("Acesso restrito à administração do site");
  const { data: perfil, error: perfilError } = await context.supabase
    .from("profiles")
    .select("ativo")
    .eq("id", context.userId)
    .maybeSingle();
  if (perfilError || !perfil?.ativo) throw new Error("Conta administrativa inativa");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        cpf: z.string().regex(/^\d{11}$/),
        role: z.enum(["admin", "comum"]).default("comum"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senhaTemporaria = gerarSenhaTemporaria();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.cpf}@${DOMAIN}`,
      password: senhaTemporaria,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, nome: data.nome, cpf: data.cpf, senha_temporaria: true });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { ok: true, senhaTemporaria };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), senha: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ senha_temporaria: true }).eq("id", data.userId);
    return { ok: true };
  });

/**
 * Roster de cadastro de TODOS os usuários (todos os grupos) — só admin.
 * Devolve apenas dado de cadastro (CPF mascarado, nunca financeiro), como
 * combinado: admin enxerga "quem é", não os dados financeiros de grupos
 * que não são o dele. Usa o cliente service-role de propósito, pra não
 * depender de a policy de `profiles` continuar liberando select global pra
 * admin caso ela mude no futuro.
 */
export const adminListarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("profiles")
      .select(
        "id, nome, cpf, email, telefone, data_nascimento, ativo, grupo_id, convidado_por, created_at, grupos:grupo_id(nome)",
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: roles } = await db.from("user_roles").select("user_id, role");
    const { ehAdminPrincipal } = await import("@/lib/conta-exclusao.server");
    const solicitanteEhPrincipal = await ehAdminPrincipal(context.userId);
    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      nome: p.nome as string,
      cpfMascarado: maskCpfPrivate(p.cpf ?? ""),
      email: (p.email as string | null) ?? null,
      telefone: (p.telefone as string | null) ?? null,
      dataNascimento: (p.data_nascimento as string | null) ?? null,
      ativo: !!p.ativo,
      grupoId: (p.grupo_id as string | null) ?? null,
      grupoNome: (p.grupos?.nome as string | undefined) ?? null,
      convidadoPor: (p.convidado_por as string | null) ?? null,
      criadoEm: p.created_at as string,
      role: (roles ?? []).find((r: any) => r.user_id === p.id)?.role ?? "comum",
      solicitanteEhPrincipal,
    }));
  });

/**
 * Remove uma conta comum com duas confirmações literais e guarda uma cópia
 * do cadastro/vínculo por 90 dias. Somente o administrador principal pode
 * executar. Nenhuma conta administrativa pode ser alvo.
 */
export const adminExcluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        confirmacao1: z.literal("DELETAR"),
        confirmacao2: z.literal("Confirmo Delete"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { ehAdminPrincipal, arquivarEExcluirConta } = await import(
      "@/lib/conta-exclusao.server"
    );
    if (!(await ehAdminPrincipal(context.userId))) {
      throw new Error("Somente Matheus, administrador principal, pode excluir usuários.");
    }
    if (data.userId === context.userId) {
      throw new Error("A conta administrativa principal não pode ser excluída.");
    }
    await arquivarEExcluirConta({ userId: data.userId, excluidaPor: context.userId });
    return { ok: true as const, recuperavelPorDias: 90 };
  });

/**
 * Lista TODOS os convites gerados por TODOS os usuários (não só os seus) —
 * só admin. Usa service role de propósito: a policy de `convites` é
 * `criado_por = auth.uid()`, sem bypass pra admin, então uma consulta com o
 * cliente normal só devolveria os convites do próprio admin.
 */
export const adminListarConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("convites")
      .select(
        "id, token, usado, usado_por, criado_em, expira_em, criado_por, criador:criado_por(nome)",
      )
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      id: c.id as string,
      token: c.token as string,
      usado: !!c.usado,
      usadoPor: (c.usado_por as string | null) ?? null,
      criadoEm: c.criado_em as string,
      expiraEm: c.expira_em as string,
      criadoPorId: c.criado_por as string,
      criadoPorNome: (c.criador?.nome as string | undefined) ?? "—",
    }));
  });

/** Cancela qualquer convite ainda não usado, de qualquer pessoa — só admin. */
export const adminCancelarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { ehAdminPrincipal } = await import("@/lib/conta-exclusao.server");
    if (!(await ehAdminPrincipal(context.userId))) {
      throw new Error("Somente o administrador principal pode revogar convites de outras pessoas.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: convite, error } = await db
      .from("convites")
      .select("usado")
      .eq("id", data.conviteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!convite) throw new Error("Convite não encontrado.");
    if (convite.usado) throw new Error("Este convite já foi usado — não é possível cancelar.");
    const { error: delError } = await db.from("convites").delete().eq("id", data.conviteId);
    if (delError) throw new Error(delError.message);
    return { ok: true as const };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "comum"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    return { ok: true };
  });

/**
 * Permite que o administrador de um grupo familiar altere o papel (admin/comum)
 * de outros membros do MESMO grupo. O admin master do site (site_admins) não pode
 * ser alterado por esta rota — apenas pelo próprio admin master.
 */
export const grupoAdminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "comum"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Buscar o grupo do solicitante e verificar se é admin do grupo
    const { data: solicitante } = await db
      .from("profiles")
      .select("grupo_id, ativo")
      .eq("id", context.userId)
      .maybeSingle();
    if (!solicitante?.ativo) throw new Error("Sua conta está inativa.");
    const { data: solRole } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (solRole?.role !== "admin") throw new Error("Apenas administradores do grupo podem alterar papéis.");

    // Verificar que o alvo pertence ao mesmo grupo
    const { data: alvo } = await db
      .from("profiles")
      .select("grupo_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!alvo || alvo.grupo_id !== solicitante.grupo_id) throw new Error("Usuário não encontrado no seu grupo.");

    // Impedir alterar um admin master do site
    const { data: ehSiteAdmin } = await db
      .from("site_admins")
      .select("user_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (ehSiteAdmin) throw new Error("Não é possível alterar o papel do administrador master do site.");

    // Impedir alterar a si mesmo
    if (data.userId === context.userId) throw new Error("Você não pode alterar seu próprio papel.");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });

    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "grupo_admin_alterou_papel",
      alvo_id: data.userId,
      detalhes: { novo_papel: data.role },
    });

    return { ok: true };
  });
