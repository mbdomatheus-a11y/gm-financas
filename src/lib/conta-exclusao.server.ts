import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CPF_ADMIN_PRINCIPAL = "08857166635";

export async function ehAdminPrincipal(userId: string): Promise<boolean> {
  const db = supabaseAdmin as any;
  const { data } = await db.from("profiles").select("cpf").eq("id", userId).maybeSingle();
  return data?.cpf === CPF_ADMIN_PRINCIPAL;
}

export async function arquivarEExcluirConta(params: {
  userId: string;
  excluidaPor: string;
}): Promise<void> {
  const db = supabaseAdmin as any;
  const { data: perfil, error: perfilError } = await db
    .from("profiles")
    .select("id, nome, cpf, email, telefone, data_nascimento, grupo_id, convidado_por, ativo, created_at")
    .eq("id", params.userId)
    .maybeSingle();
  if (perfilError) throw new Error(perfilError.message);
  if (!perfil) throw new Error("Usuário não encontrado.");

  const { data: roleRow } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (roleRow?.role === "admin") {
    throw new Error("Contas administrativas não podem ser excluídas por segurança.");
  }

  const { data: authData, error: authReadError } = await supabaseAdmin.auth.admin.getUserById(
    params.userId,
  );
  if (authReadError) throw new Error(authReadError.message);

  const email = perfil.email ?? authData.user?.email ?? null;
  const { error: archiveError } = await db.from("contas_excluidas").insert({
    auth_user_id_original: perfil.id,
    cpf: perfil.cpf,
    email,
    nome: perfil.nome,
    telefone: perfil.telefone,
    data_nascimento: perfil.data_nascimento,
    grupo_id: perfil.grupo_id,
    role: roleRow?.role ?? "comum",
    perfil_snapshot: perfil,
    excluida_por: params.excluidaPor,
  });
  if (archiveError) throw new Error(archiveError.message);

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(params.userId, false);
  if (deleteError) throw new Error(deleteError.message);
}
