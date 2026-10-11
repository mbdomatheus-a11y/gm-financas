import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useFinance";
import { useCategoriasPadrao } from "@/hooks/useCategoriasPadrao";
import { montarEstrutura, macroDe, type MacroEstrutura } from "@/lib/macro-categorias";

export type LinhaSubcategoria = { id: string; categoria: string; nome: string; tipo: "receita" | "despesa" };

/**
 * Estrutura de macro + subcategorias usada em telas e seletores (2026-10-11).
 * Junta as macros padrão, as macros criadas pelo usuário e as subcategorias
 * cadastradas. Veja src/lib/macro-categorias.ts para as regras de leitura.
 */
export function useEstruturaCategorias(tipo: "receita" | "despesa" = "despesa") {
  const qc = useQueryClient();
  const { lista: padraoLista } = useCategoriasPadrao();
  const { data: categorias = [] } = useCategorias(tipo);

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", tipo],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subcategorias")
        .select("id,categoria,nome,tipo")
        .eq("tipo", tipo)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LinhaSubcategoria[];
    },
  });

  const estrutura: MacroEstrutura[] = useMemo(
    () =>
      montarEstrutura({
        padrao: tipo === "despesa" ? padraoLista : [],
        categorias: (categorias as any[]).map((c) => ({ nome: c.nome })),
        subcategorias: subcategorias.map((s) => ({ categoria: s.categoria, nome: s.nome })),
      }),
    [tipo, padraoLista, categorias, subcategorias],
  );

  const macros = useMemo(() => new Set(estrutura.map((e) => e.macro)), [estrutura]);

  const criarSubcategoria = useMutation({
    mutationFn: async ({ categoria, nome }: { categoria: string; nome: string }) => {
      const limpo = nome.replace(/\s+/g, " ").trim();
      if (limpo.length < 2) throw new Error("Informe o nome da subcategoria.");
      const { error } = await (supabase as any)
        .from("subcategorias")
        .insert({ categoria, nome: limpo, tipo });
      if (error && !String(error.message).includes("duplicate")) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcategorias", tipo] }),
  });

  const excluirSubcategorias = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await (supabase as any).from("subcategorias").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcategorias", tipo] }),
  });

  return {
    estrutura,
    macros,
    subcategorias,
    macroDe: (nome: string | null | undefined) => macroDe(nome, macros),
    criarSubcategoria,
    excluirSubcategorias,
  };
}
