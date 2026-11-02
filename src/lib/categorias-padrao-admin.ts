import { supabase } from "@/integrations/supabase/client";

/**
 * Categoria criada pelo admin master (site_admins) vira sugestão padrão para todos os clientes:
 * entra em categorias_padrao (que o site e o app leem). Categorias de usuários comuns e de outros
 * admins ficam só no grupo de quem criou. Só insere os nomes que ainda não existem.
 */
export async function espelharCategoriaNoPadrao(nomes: string[]): Promise<void> {
  const limpos = nomes.map((n) => n.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (limpos.length === 0) return;
  const { data: existentes, error: erroLeitura } = await (supabase as any)
    .from("categorias_padrao")
    .select("nome,ordem");
  if (erroLeitura) throw erroLeitura;
  const lista = (existentes ?? []) as { nome: string; ordem: number | null }[];
  const ja = new Set(lista.map((c) => c.nome.toLowerCase()));
  const maiorOrdem = Math.max(-1, ...lista.map((c) => Number(c.ordem) || 0));
  const novas = limpos
    .filter((nome, i) => !ja.has(nome.toLowerCase()) && limpos.findIndex((x) => x.toLowerCase() === nome.toLowerCase()) === i)
    .map((nome, i) => ({ nome, subcategorias: [] as string[], ordem: maiorOrdem + 1 + i, ativo: true }));
  if (novas.length === 0) return;
  const { error } = await (supabase as any).from("categorias_padrao").insert(novas);
  if (error) throw error;
}
