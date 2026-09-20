import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function ehAdminPrincipal(userId: string): Promise<boolean> {
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("site_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function arquivarEExcluirConta(params: {
  userId: string;
  excluidaPor: string;
}): Promise<void> {
  const db = supabaseAdmin as any;
  const { data: perfil, error: perfilError } = await db
    .from("profiles")
    .select(
      "id, nome, cpf, email, telefone, data_nascimento, grupo_id, convidado_por, ativo, created_at",
    )
    .eq("id", params.userId)
    .maybeSingle();
  if (perfilError) throw new Error(perfilError.message);
  if (!perfil) throw new Error("Usuário não encontrado.");

  if (await ehAdminPrincipal(params.userId)) {
    throw new Error("A conta da administração do site não pode ser excluída.");
  }

  const { data: roleRow } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (roleRow?.role === "admin") {
    throw new Error("A exclusão desta conta exige a migração segura dos dados do grupo.");
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
