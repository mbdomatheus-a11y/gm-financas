import { supabase } from "@/integrations/supabase/client";

// Lista única de tabelas por módulo: usada pelo backup (Administração) e pelo "Baixar meus dados" da Conta.

/**
 * Um módulo por linha de UI. `tabelas` é usado no backup/restauração (ordem
 * não importa ali, é upsert). `resetOrder` é usado só no reset e importa:
 * filhos antes de pais, mesmo quando a maioria das FKs já é CASCADE/SET NULL
 * — deixamos explícito para não depender só do comportamento do banco.
 */
export const MODULOS = [
  {
    key: "receitas",
    label: "Receitas",
    tabelas: ["receitas"],
    resetOrder: ["receitas"],
  },
  {
    key: "despesas",
    label: "Despesas (fixas, variáveis, parcelas e fatura do mês)",
    tabelas: ["despesas", "parcelas", "parcela_auditoria", "fatura_mes"],
    resetOrder: ["parcela_auditoria", "parcelas", "fatura_mes", "despesas"],
  },
  {
    key: "cartoes_bancos",
    label: "Cartões e bancos",
    tabelas: ["cartoes", "bancos", "cartao_vinculos"],
    resetOrder: ["cartao_vinculos", "cartoes", "bancos"],
  },
  {
    key: "categorias",
    label: "Categorias",
    tabelas: ["categorias"],
    resetOrder: ["categorias"],
  },
  {
    key: "de_para",
    label: "De-para de categorias",
    tabelas: ["categoria_regras"],
    resetOrder: ["categoria_regras"],
  },
  {
    key: "investimentos",
    label: "Investimentos",
    tabelas: ["investimentos", "investimento_movimentos"],
    resetOrder: ["investimento_movimentos", "investimentos"],
  },
  {
    key: "veiculos",
    label: "Meu Veículo (documentos e eventos)",
    tabelas: ["veiculos", "veiculo_documentos", "veiculo_eventos"],
    resetOrder: ["veiculo_eventos", "veiculo_documentos", "veiculos"],
  },
  {
    key: "notas_fiscais",
    label: "Notas fiscais",
    tabelas: ["notas_fiscais", "nota_itens", "nota_arquivos", "nota_vinculos"],
    resetOrder: ["nota_vinculos", "nota_arquivos", "nota_itens", "notas_fiscais"],
  },
  {
    key: "lista_compras",
    label: "Lista de compras",
    tabelas: ["lista_compras"],
    resetOrder: ["lista_compras"],
  },
  {
    key: "importacao",
    label: "Faturas importadas (histórico, comprovantes e layouts aprendidos)",
    tabelas: ["import_lotes", "import_faturas", "fatura_layouts", "comprovantes"],
    resetOrder: ["comprovantes", "import_faturas", "import_lotes", "fatura_layouts"],
  },
  {
    key: "configuracoes",
    label: "Configurações do casal (ex.: pasta do Google Drive)",
    tabelas: ["configuracoes_casal"],
    resetOrder: ["configuracoes_casal"],
  },
] as const;

export type ModuloKey = (typeof MODULOS)[number]["key"];
export type Backup = {
  versao: number;
  gerado_em: string;
  modulos: ModuloKey[];
  dados: Record<string, any[]>;
};

export async function baixarModulos(chaves: ModuloKey[]): Promise<Backup> {
  const dados: Record<string, any[]> = {};
  const tabelas = MODULOS.filter((m) => chaves.includes(m.key)).flatMap((m) => m.tabelas);
  for (const t of tabelas) {
    const { data, error } = await supabase.from(t as any).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    dados[t] = data ?? [];
  }
  return { versao: 2, gerado_em: new Date().toISOString(), modulos: chaves, dados };
}

/** Todos os dados que a pessoa enxerga no grupo (LGPD, art. 18: acesso e portabilidade). */
export async function baixarTodosOsDados(): Promise<Backup> {
  return baixarModulos(MODULOS.map((m) => m.key));
}
