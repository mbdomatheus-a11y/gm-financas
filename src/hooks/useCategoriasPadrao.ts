import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIAS_PADRAO } from "@/lib/categorizacao";

export type CategoriaPadrao = { id: string; nome: string; subcategorias: string[]; ordem: number };

/**
 * Categorias sugeridas a todos os usuários. A lista vem da administração
 * (tabela `categorias_padrao`); se a leitura falhar ou vier vazia, cai na lista
 * embutida no código para o site nunca ficar sem sugestões.
 */
export function useCategoriasPadrao() {
  const { data } = useQuery({
    queryKey: ["categorias-padrao"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categorias_padrao")
        .select("id,nome,subcategorias,ordem")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as CategoriaPadrao[];
    },
  });
  const lista: CategoriaPadrao[] =
    data && data.length > 0
      ? data
      : Object.entries(CATEGORIAS_PADRAO).map(([nome, subcategorias], i) => ({
          id: nome,
          nome,
          subcategorias,
          ordem: i,
        }));
  const mapa: Record<string, string[]> = Object.fromEntries(
    lista.map((c) => [c.nome, c.subcategorias]),
  );
  return { lista, mapa, subcategoriasDe: (cat: string) => mapa[cat] ?? [] };
}
