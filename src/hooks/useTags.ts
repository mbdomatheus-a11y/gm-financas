import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ehTabelaInexistente } from "@/hooks/useLimites";

/**
 * Tags livres para despesas e receitas (07/11/2026). Tabelas `tags`,
 * `despesa_tags` e `receita_tags` (migration 20261107110000_limites_tags.sql).
 * As tags são do grupo (casa), como as categorias.
 */

export type Tag = { id: string; nome: string; cor: string; created_at?: string };
export type TipoLancamentoTag = "despesa" | "receita";

/** 8 cores da paleta do site para as tags (a primeira é a cor da marca). */
export const CORES_TAGS: { valor: string; nome: string }[] = [
  { valor: "#1670B8", nome: "Azul" },
  { valor: "#0EA5A4", nome: "Turquesa" },
  { valor: "#16A34A", nome: "Verde" },
  { valor: "#CA8A04", nome: "Mostarda" },
  { valor: "#EA580C", nome: "Laranja" },
  { valor: "#DC2626", nome: "Vermelho" },
  { valor: "#DB2777", nome: "Rosa" },
  { valor: "#7C3AED", nome: "Roxo" },
];
export const COR_TAG_PADRAO = CORES_TAGS[0]!.valor;

const CHAVE_TAGS = ["tags"] as const;

function tabelaVinculo(tipo: TipoLancamentoTag) {
  return tipo === "despesa"
    ? { tabela: "despesa_tags", coluna: "despesa_id" }
    : { tabela: "receita_tags", coluna: "receita_id" };
}

function limparNome(nome: string): string {
  return nome.replace(/\s+/g, " ").trim();
}

function erroAmigavel(error: any): Error {
  if (ehTabelaInexistente(error)) return new Error("As tags ainda não foram ativadas no banco.");
  if (String(error?.code) === "23505") return new Error("Já existe uma tag com esse nome.");
  return error instanceof Error ? error : new Error(String(error?.message ?? "Erro ao salvar a tag."));
}

/** Lista as tags do grupo, com criar, editar e excluir. */
export function useTags() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: CHAVE_TAGS,
    queryFn: async (): Promise<{ tags: Tag[]; tabelaPendente: boolean }> => {
      const { data, error } = await (supabase as any).from("tags").select("id,nome,cor,created_at").order("nome");
      if (error) {
        if (ehTabelaInexistente(error)) return { tags: [], tabelaPendente: true };
        throw error;
      }
      return {
        tags: (data ?? []).map((t: any) => ({ id: String(t.id), nome: t.nome, cor: t.cor || COR_TAG_PADRAO, created_at: t.created_at })),
        tabelaPendente: false,
      };
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: CHAVE_TAGS });
    qc.invalidateQueries({ queryKey: ["tags-vinculos"] });
  };

  const criar = useMutation({
    mutationFn: async ({ nome, cor }: { nome: string; cor?: string }): Promise<Tag> => {
      const limpo = limparNome(nome);
      if (!limpo) throw new Error("Informe o nome da tag.");
      if (limpo.length > 40) throw new Error("Use até 40 caracteres.");
      const { data, error } = await (supabase as any)
        .from("tags")
        .insert({ nome: limpo, cor: cor || COR_TAG_PADRAO })
        .select("id,nome,cor")
        .single();
      if (error) throw erroAmigavel(error);
      return { id: String(data.id), nome: data.nome, cor: data.cor };
    },
    onSuccess: invalidar,
  });

  const editar = useMutation({
    mutationFn: async ({ id, nome, cor }: { id: string; nome?: string; cor?: string }) => {
      const patch: Record<string, string> = {};
      if (nome != null) {
        const limpo = limparNome(nome);
        if (!limpo) throw new Error("Informe o nome da tag.");
        if (limpo.length > 40) throw new Error("Use até 40 caracteres.");
        patch["nome"] = limpo;
      }
      if (cor) patch["cor"] = cor;
      if (Object.keys(patch).length === 0) return;
      const { error } = await (supabase as any).from("tags").update(patch).eq("id", id);
      if (error) throw erroAmigavel(error);
    },
    onSuccess: invalidar,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("tags").delete().eq("id", id);
      if (error) throw erroAmigavel(error);
    },
    onSuccess: invalidar,
  });

  return {
    tags: query.data?.tags ?? [],
    tabelaPendente: query.data?.tabelaPendente ?? false,
    isLoading: query.isLoading,
    criar,
    editar,
    excluir,
  };
}

/**
 * Todos os vínculos de um tipo (despesa ou receita): Map lancamentoId -> tagIds.
 * Útil para mostrar as tags nas listas e filtrar por tag.
 */
export function useVinculosTags(tipo: TipoLancamentoTag) {
  const { tabela, coluna } = tabelaVinculo(tipo);
  return useQuery({
    queryKey: ["tags-vinculos", tipo],
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data, error } = await (supabase as any).from(tabela).select(`${coluna},tag_id`);
      if (error) {
        if (ehTabelaInexistente(error)) return new Map();
        throw error;
      }
      const mapa = new Map<string, string[]>();
      for (const v of data ?? []) {
        const k = String(v[coluna]);
        mapa.set(k, [...(mapa.get(k) ?? []), String(v.tag_id)]);
      }
      return mapa;
    },
  });
}

/** Tags de um lançamento específico (ids). */
export function useTagsDoLancamento(tipo: TipoLancamentoTag, lancamentoId: string | null | undefined) {
  const { tabela, coluna } = tabelaVinculo(tipo);
  return useQuery({
    queryKey: ["tags-vinculos", tipo, lancamentoId],
    enabled: !!lancamentoId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).from(tabela).select("tag_id").eq(coluna, lancamentoId);
      if (error) {
        if (ehTabelaInexistente(error)) return [];
        throw error;
      }
      return (data ?? []).map((v: any) => String(v.tag_id));
    },
  });
}

/** Função de servidor: grava exatamente `tagIds` no lançamento (adiciona e remove o que mudou). */
export async function definirTagsDoLancamento(
  tipo: TipoLancamentoTag,
  lancamentoId: string,
  tagIds: string[],
): Promise<void> {
  const { tabela, coluna } = tabelaVinculo(tipo);
  const { data, error } = await (supabase as any).from(tabela).select("tag_id").eq(coluna, lancamentoId);
  if (error) throw erroAmigavel(error);
  const atuais = new Set<string>((data ?? []).map((v: any) => String(v.tag_id)));
  const desejadas = new Set(tagIds);
  const remover = [...atuais].filter((id) => !desejadas.has(id));
  const adicionar = [...desejadas].filter((id) => !atuais.has(id));
  if (remover.length) {
    const r = await (supabase as any).from(tabela).delete().eq(coluna, lancamentoId).in("tag_id", remover);
    if (r.error) throw erroAmigavel(r.error);
  }
  if (adicionar.length) {
    const r = await (supabase as any)
      .from(tabela)
      .upsert(adicionar.map((tag_id) => ({ [coluna]: lancamentoId, tag_id })), { onConflict: `${coluna},tag_id`, ignoreDuplicates: true });
    if (r.error) throw erroAmigavel(r.error);
  }
}

/** Vincular, desvincular e definir tags de despesas/receitas. */
export function useVincularTags(tipo: TipoLancamentoTag) {
  const qc = useQueryClient();
  const { tabela, coluna } = tabelaVinculo(tipo);
  const invalidar = () => qc.invalidateQueries({ queryKey: ["tags-vinculos", tipo] });

  const vincular = useMutation({
    mutationFn: async ({ lancamentoId, tagId }: { lancamentoId: string; tagId: string }) => {
      const { error } = await (supabase as any)
        .from(tabela)
        .upsert({ [coluna]: lancamentoId, tag_id: tagId }, { onConflict: `${coluna},tag_id`, ignoreDuplicates: true });
      if (error) throw erroAmigavel(error);
    },
    onSuccess: invalidar,
  });

  const desvincular = useMutation({
    mutationFn: async ({ lancamentoId, tagId }: { lancamentoId: string; tagId: string }) => {
      const { error } = await (supabase as any).from(tabela).delete().eq(coluna, lancamentoId).eq("tag_id", tagId);
      if (error) throw erroAmigavel(error);
    },
    onSuccess: invalidar,
  });

  const definir = useMutation({
    mutationFn: ({ lancamentoId, tagIds }: { lancamentoId: string; tagIds: string[] }) =>
      definirTagsDoLancamento(tipo, lancamentoId, tagIds),
    onSuccess: invalidar,
  });

  return { vincular, desvincular, definir };
}
