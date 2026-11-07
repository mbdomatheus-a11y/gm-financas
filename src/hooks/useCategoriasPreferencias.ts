import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useFinance";
import { ehTabelaInexistente } from "@/hooks/useLimites";

/**
 * Preferências por categoria (07/11/2026): `oculta` (some dos seletores sem apagar histórico) e
 * `essencial` (true essencial, false supérfluo, null não definido). Colunas novas em `categorias`
 * (migration 20261107110000_limites_tags.sql). A tabela é do grupo (casa).
 *
 * Categorias padrão (categorias_padrao) não têm linha em `categorias`: ao marcar uma delas, a linha
 * é criada com o mesmo nome e tipo (montarEstrutura deduplica pelo nome, nada aparece repetido).
 */

export type TipoCategoria = "receita" | "despesa";
export type PreferenciaCategoria = { oculta: boolean; essencial: boolean | null };

function chave(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function colunaPendente(error: any): boolean {
  return ehTabelaInexistente(error) || String(error?.code) === "42703" || String(error?.code) === "PGRST204";
}

async function gravarPreferencia(
  nome: string,
  tipo: TipoCategoria,
  patch: Partial<PreferenciaCategoria>,
): Promise<void> {
  const limpo = nome.replace(/\s+/g, " ").trim();
  if (!limpo) throw new Error("Categoria sem nome.");
  const { data, error } = await (supabase as any)
    .from("categorias")
    .select("id,nome")
    .eq("tipo", tipo)
    .ilike("nome", limpo);
  if (error) throw error;
  const existente = (data ?? []).find((c: any) => chave(c.nome) === chave(limpo));
  const r = existente
    ? await (supabase as any).from("categorias").update(patch).eq("id", existente.id)
    : await (supabase as any).from("categorias").insert({ nome: limpo, tipo, ...patch });
  if (r.error) {
    if (colunaPendente(r.error)) throw new Error("As preferências de categoria ainda não foram ativadas no banco.");
    throw r.error;
  }
}

/** Marca ou desmarca a categoria como oculta. */
export function marcarCategoriaOculta(nome: string, tipo: TipoCategoria, oculta: boolean): Promise<void> {
  return gravarPreferencia(nome, tipo, { oculta });
}

/** Define se a categoria é essencial (true), supérflua (false) ou não definida (null). */
export function marcarCategoriaEssencial(
  nome: string,
  tipo: TipoCategoria,
  essencial: boolean | null,
): Promise<void> {
  return gravarPreferencia(nome, tipo, { essencial });
}

/**
 * Hook com as preferências já lidas (por nome normalizado) e mutations prontas.
 * `colunasPendentes` fica true enquanto a migration não for aplicada (as linhas vêm sem os campos).
 */
export function useCategoriasPreferencias(tipo: TipoCategoria = "despesa") {
  const qc = useQueryClient();
  const { data: categorias = [], isSuccess } = useCategorias(tipo);

  const preferencias = useMemo(() => {
    const mapa = new Map<string, PreferenciaCategoria>();
    for (const c of categorias as any[]) {
      mapa.set(chave(String(c.nome ?? "")), {
        oculta: c.oculta === true,
        essencial: typeof c.essencial === "boolean" ? c.essencial : null,
      });
    }
    return mapa;
  }, [categorias]);

  const colunasPendentes =
    isSuccess && (categorias as any[]).length > 0 && !("oculta" in ((categorias as any[])[0] ?? {}));

  const preferenciaDe = (nome: string | null | undefined): PreferenciaCategoria =>
    preferencias.get(chave(String(nome ?? ""))) ?? { oculta: false, essencial: null };

  const invalidar = () => qc.invalidateQueries({ queryKey: ["categorias", tipo] });

  const definirOculta = useMutation({
    mutationFn: ({ nome, oculta }: { nome: string; oculta: boolean }) => marcarCategoriaOculta(nome, tipo, oculta),
    onSuccess: invalidar,
  });

  const definirEssencial = useMutation({
    mutationFn: ({ nome, essencial }: { nome: string; essencial: boolean | null }) =>
      marcarCategoriaEssencial(nome, tipo, essencial),
    onSuccess: invalidar,
  });

  return {
    preferencias,
    preferenciaDe,
    estaOculta: (nome: string | null | undefined) => preferenciaDe(nome).oculta,
    colunasPendentes,
    definirOculta,
    definirEssencial,
  };
}
