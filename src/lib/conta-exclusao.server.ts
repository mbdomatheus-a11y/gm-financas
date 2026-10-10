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

// Tabelas com grupo_id que NÃO apagam em cascata junto com o grupo. Usadas só
// quando o grupo ficou sem nenhum membro. As demais (pets, exames, convites
// etc.) caem por cascata ou ficam sem vínculo ao apagar o grupo.
const TABELAS_DO_GRUPO = [
  "parcelas",
  "despesas",
  "investimento_movimentos",
  "investimentos",
  "import_faturas",
  "import_lotes",
  "fatura_mes",
  "fatura_layouts",
  "fatura_correcoes_usuario",
  "veiculo_documentos",
  "veiculos",
  "notas_fiscais",
  "lista_compras",
  "receitas",
  "cartao_vinculos",
  "cartoes",
  "bancos",
  "categoria_regras",
  "categorias",
  "permissoes",
  "convites",
  "configuracoes_casal",
] as const;

async function apagarDadosDoGrupo(grupoId: string): Promise<void> {
  const db = supabaseAdmin as any;
  // Repete porque a ordem de dependência entre tabelas varia: uma passada
  // pode falhar por chave estrangeira e passar na seguinte.
  for (let passada = 0; passada < 6; passada++) {
    let pendentes = 0;
    for (const tabela of TABELAS_DO_GRUPO) {
      const { error } = await db.from(tabela).delete().eq("grupo_id", grupoId);
      if (error) pendentes++;
    }
    if (pendentes === 0) break;
  }
  const { error } = await db.from("grupos").delete().eq("id", grupoId);
  if (error) throw new Error(`Não foi possível apagar o grupo: ${error.message}`);
}

/**
 * Conclui as exclusões cujo prazo de 90 dias terminou: apaga a conta e os
 * dados pessoais (cascata a partir do usuário) e, se a pessoa era a última do
 * grupo, também os dados do grupo. Arquivos já enviados ao armazenamento
 * externo NÃO são removidos aqui (ver docs/PENDENCIAS.md).
 */
export async function concluirExclusoesVencidas(): Promise<{ removidas: number; falhas: number }> {
  const db = supabaseAdmin as any;
  const { data: vencidas, error } = await db
    .from("exclusoes_agendadas")
    .select("user_id")
    .lte("prevista_em", new Date().toISOString())
    .limit(20);
  if (error || !vencidas?.length) return { removidas: 0, falhas: 0 };
  let removidas = 0;
  let falhas = 0;
  for (const { user_id: userId } of vencidas as { user_id: string }[]) {
    try {
      if (await ehAdminPrincipal(userId)) {
        await db.from("exclusoes_agendadas").delete().eq("user_id", userId);
        continue;
      }
      const { data: perfil } = await db
        .from("profiles")
        .select("grupo_id,grupo_secundario_id")
        .eq("id", userId)
        .maybeSingle();
      const grupos = [perfil?.grupo_id, perfil?.grupo_secundario_id].filter(Boolean) as string[];
      const orfaos: string[] = [];
      for (const g of grupos) {
        const { data: outros } = await db
          .from("profiles")
          .select("id")
          .neq("id", userId)
          .or(`grupo_id.eq.${g},grupo_secundario_id.eq.${g}`)
          .limit(1);
        if (!outros?.length) orfaos.push(g);
      }
      // Dados do grupo primeiro: só quando a pessoa era a última a usá-lo.
      for (const g of orfaos) {
        await db.from("profiles").update({ grupo_id: null }).eq("id", userId).eq("grupo_id", g);
        await db
          .from("profiles")
          .update({ grupo_secundario_id: null })
          .eq("id", userId)
          .eq("grupo_secundario_id", g);
        await apagarDadosDoGrupo(g);
      }
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delError) throw new Error(delError.message);
      await db.from("exclusoes_agendadas").delete().eq("user_id", userId);
      await db.from("admin_audit_logs").insert({
        acao: "conta_excluida_apos_carencia",
        alvo_id: userId,
        detalhes: { grupos_apagados: orfaos.length },
      });
      removidas++;
    } catch (e) {
      falhas++;
      console.error("[exclusao] falha ao concluir", userId, e instanceof Error ? e.message : e);
    }
  }
  return { removidas, falhas };
}
