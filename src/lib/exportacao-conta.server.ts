// Exportação completa dos dados de uma conta em JSON (usada pelo próprio usuário e pelo
// envio de encerramento feito pela administração). Só roda no servidor.

type Db = any;

/** Tabelas em que cada linha tem quem criou: exporta só o que a própria pessoa criou dentro do grupo. */
const TABELAS_POR_CRIADOR = [
  "despesas",
  "receitas",
  "caixinhas",
  "caixinha_aportes",
  "investimentos",
  "investimento_movimentos",
  "lista_compras",
  "notas_fiscais",
  "veiculos",
  "categoria_regras",
  "fatura_mes",
] as const;

/** Cadastros do grupo (bancos, cartões, categorias, parcelas etc.): exporta todos do grupo. */
const TABELAS_DO_GRUPO = [
  "bancos",
  "cartoes",
  "categorias",
  "parcelas",
  "cartao_faturas_banco",
  "cartao_vinculos",
  "configuracoes_casal",
  "pet_animais",
  "pet_vacinas",
  "veiculo_eventos",
  "veiculo_documentos",
  "itens_armazenados",
  "locais_armazenamento",
  "exames_registros",
] as const;

/** Lê a tabela inteira em páginas de 1000 linhas (o limite padrão do banco). */
async function lerTudo(db: Db, tabela: string, filtro: (q: any) => any): Promise<unknown[]> {
  const linhas: unknown[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtro(db.from(tabela).select("*")).range(de, de + 999);
    if (error) throw new Error(`Não foi possível ler ${tabela}.`);
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

export async function montarExportacaoConta(db: Db, userId: string) {
  const { data: perfil, error: erroPerfil } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (erroPerfil || !perfil) throw new Error("Conta não encontrada.");
  const { data: auth } = await db.auth.admin.getUserById(userId);
  const grupoId = (perfil.grupo_id as string | null) ?? null;

  const dados: Record<string, unknown[]> = {};
  dados["preferencias_usuario"] = await lerTudo(db, "preferencias_usuario", (q) => q.eq("user_id", userId));
  dados["chamados_suporte"] = await lerTudo(db, "chamados_suporte", (q) => q.eq("user_id", userId));
  if (grupoId) {
    for (const tabela of TABELAS_POR_CRIADOR) {
      dados[tabela] = await lerTudo(db, tabela, (q) => q.eq("grupo_id", grupoId).eq("created_by", userId));
    }
    for (const tabela of TABELAS_DO_GRUPO) {
      dados[tabela] = await lerTudo(db, tabela, (q) => q.eq("grupo_id", grupoId));
    }
  }

  return {
    formato: "controlall-exportacao-v1",
    geradoEm: new Date().toISOString(),
    conta: {
      id: userId,
      email: (auth?.user?.email as string | undefined) ?? (perfil.email as string | null) ?? null,
      nome: perfil.nome ?? null,
      criadaEm: perfil.created_at ?? null,
    },
    perfil,
    grupoId,
    dados,
    observacao:
      "Dados de cadastro, lançamentos e configurações da conta. Cadastros do grupo (bancos, cartões, categorias) são do grupo; lançamentos são os que você criou.",
  };
}
