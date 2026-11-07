import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Checagem ÚNICA de acesso à integração Open Finance (Pluggy) no servidor (07/11/2026).
 *
 * Regra: pode usar quem é admin do site (site_admins) OU, com o módulo "open_finance" habilitado,
 * qualquer usuário autenticado e ativo que esteja em um grupo. "Habilitado" segue a mesma conta de
 * listarModulosDisponiveis: exceção individual em modulos_usuario, se houver; senão modulos_globais.
 * Sem a linha do módulo (migration ainda não aplicada) conta como desligado. Qualquer erro de leitura
 * nega o acesso (falha fechada).
 *
 * Os dados continuam sempre limitados ao próprio usuário/grupo: quem chama usa acesso.userId e
 * acesso.grupoId nos filtros das consultas feitas com supabaseAdmin.
 */
export const MENSAGEM_SEM_ACESSO_OPEN_FINANCE = "Open Finance ainda não está disponível para sua conta.";

export type AcessoOpenFinance = { userId: string; admin: boolean; grupoId: string | null };

export async function verificarAcessoOpenFinance(userId: string): Promise<AcessoOpenFinance | null> {
  if (!userId) return null;
  const db = supabaseAdmin as any;
  const [adm, perfil, global, individual] = await Promise.all([
    db.from("site_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    db.from("profiles").select("ativo, grupo_id").eq("id", userId).maybeSingle(),
    db.from("modulos_globais").select("habilitado").eq("modulo", "open_finance").maybeSingle(),
    db.from("modulos_usuario").select("habilitado").eq("user_id", userId).eq("modulo", "open_finance").maybeSingle(),
  ]);
  if (adm.error || perfil.error) return null;
  const grupoId: string | null = perfil.data?.grupo_id ?? null;
  if (adm.data) return { userId, admin: true, grupoId };

  if (!perfil.data || perfil.data.ativo !== true || !grupoId) return null;
  if (global.error || individual.error) return null;
  const habilitado = individual.data ? individual.data.habilitado === true : global.data?.habilitado === true;
  return habilitado ? { userId, admin: false, grupoId } : null;
}

/** Lança erro com a mensagem padrão quando o usuário não pode usar o Open Finance. */
export async function exigirAcessoOpenFinance(context: { userId: string }): Promise<AcessoOpenFinance> {
  const acesso = await verificarAcessoOpenFinance(context.userId);
  if (!acesso) throw new Error(MENSAGEM_SEM_ACESSO_OPEN_FINANCE);
  return acesso;
}

/**
 * Antes de guardar uma conexão (item) para o usuário:
 *  - o item não pode já pertencer a outra pessoa (o upsert por item_id trocaria o dono e levaria
 *    os dados do banco de outra conta para este grupo);
 *  - para quem não é admin, a Pluggy precisa confirmar que o item nasceu do connect token deste
 *    usuário (clientUserId igual ao id dele). O admin fica dispensado por causa do cadastro manual
 *    de Item ID usado nos testes.
 */
export async function validarDonoDoItem(
  acesso: AcessoOpenFinance,
  itemId: string,
  buscarItem: (itemId: string) => Promise<{ clientUserId?: string | null } | null>,
): Promise<void> {
  const db = supabaseAdmin as any;
  const { data: existente, error } = await db.from("pluggy_items").select("user_id").eq("item_id", itemId).maybeSingle();
  if (error) throw new Error("Não foi possível conferir a conexão.");
  if (existente && existente.user_id !== acesso.userId) throw new Error("Esta conexão já está ligada a outra conta.");
  if (acesso.admin) return;
  let item: { clientUserId?: string | null } | null = null;
  try {
    item = await buscarItem(itemId);
  } catch {
    item = null;
  }
  if (!item || item.clientUserId !== acesso.userId) throw new Error("Conexão não encontrada para sua conta.");
}
