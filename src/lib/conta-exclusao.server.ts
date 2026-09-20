import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash, timingSafeEqual } from "node:crypto";

export function hashCodigoRecuperacao(codigo: string): string {
  return createHash("sha256").update(codigo.trim()).digest("hex");
}

export async function validarCodigoRecuperacao(
  contaExcluidaId: string,
  codigo: string,
): Promise<string> {
  const db = supabaseAdmin as any;
  const { data: token, error } = await db
    .from("contas_recuperacao_codigos")
    .select("id,token_hash,tentativas,expira_em")
    .eq("conta_excluida_id", contaExcluidaId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !token || token.tentativas >= 5 || new Date(token.expira_em).getTime() <= Date.now())
    throw new Error("Código de recuperação inválido ou expirado.");
  const informado = Buffer.from(hashCodigoRecuperacao(codigo), "hex");
  const esperado = Buffer.from(token.token_hash, "hex");
  if (informado.length !== esperado.length || !timingSafeEqual(informado, esperado)) {
    await db
      .from("contas_recuperacao_codigos")
      .update({ tentativas: token.tentativas + 1 })
      .eq("id", token.id);
    throw new Error("Código de recuperação inválido ou expirado.");
  }
  return token.id;
}

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
  accessToken?: string | undefined;
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

  const { data: authData, error: authReadError } = await supabaseAdmin.auth.admin.getUserById(
    params.userId,
  );
  if (authReadError) throw new Error(authReadError.message);

  const email = perfil.email ?? authData.user?.email ?? null;
  const { data: arquivo, error: archiveError } = await db
    .from("contas_excluidas")
    .insert({
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
    })
    .select("id")
    .single();
  if (archiveError) throw new Error(archiveError.message);

  // Retém a linha de auth e seus vínculos por 90 dias. Desativar e banir
  // impede novos logins sem disparar os ON DELETE CASCADE dos dados pessoais.
  const emailTemporario = `excluida-${params.userId}@conta.invalid`;
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(params.userId, {
    email: emailTemporario,
    ban_duration: "876000h",
  });
  if (authError) {
    await db.from("contas_excluidas").delete().eq("id", arquivo.id);
    throw new Error("Não foi possível desativar o acesso. Nenhum dado foi excluído.");
  }
  const { error: profileError } = await db
    .from("profiles")
    .update({
      nome: "Conta excluída",
      cpf: `excluida-${params.userId}`,
      email: emailTemporario,
      telefone: null,
      data_nascimento: null,
      grupo_id: null,
      ativo: false,
    })
    .eq("id", params.userId);
  if (profileError) {
    await supabaseAdmin.auth.admin.updateUserById(params.userId, {
      email: authData.user?.email ?? email ?? undefined,
      ban_duration: "none",
    });
    await db.from("contas_excluidas").delete().eq("id", arquivo.id);
    throw new Error("Não foi possível desativar a conta sem perda de dados.");
  }
  if (params.accessToken) {
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
      params.accessToken,
      "global",
    );
    if (signOutError) console.error("[conta] Falha ao revogar sessões:", signOutError.message);
  }
}
