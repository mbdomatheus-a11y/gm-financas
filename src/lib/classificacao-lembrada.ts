import { supabase } from "@/integrations/supabase/client";
import { chaveEstabelecimento } from "@/lib/categorizacao";

/**
 * Memória de classificação por estabelecimento (2026-10-10).
 *
 * Quando o usuário diz a categoria e a subcategoria certas de um gasto — ao
 * salvar a despesa ou ao revisar em "Para onde vai meu dinheiro" — isso fica
 * guardado para o mesmo estabelecimento. A importação lê essa memória antes de
 * classificar sozinha, então o de-para automático vira apenas uma suspeita a
 * revisar, nunca a palavra final.
 *
 * Nunca derruba a ação principal: se a memória falhar, o gasto é salvo do
 * mesmo jeito.
 */
export async function lembrarClassificacao(p: {
  descricao: string;
  categoria: string;
  subcategoria: string | null;
  tipo: string;
  userId: string | null;
}): Promise<void> {
  try {
    const chave = chaveEstabelecimento(p.descricao);
    if (!chave || !p.userId) return;
    const { data: perfil } = await supabase
      .from("profiles")
      .select("grupo_id")
      .eq("id", p.userId)
      .maybeSingle();
    if (!perfil?.grupo_id) return;
    await supabase.from("importacao_preferencias").upsert(
      {
        grupo_id: perfil.grupo_id,
        chave,
        escopo: "classificacao",
        acao: JSON.stringify({
          categoria: p.categoria,
          subcategoria: p.subcategoria,
          tipo: p.tipo,
        }),
        criado_por: p.userId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "grupo_id,chave,escopo" },
    );
  } catch {
    /* a memória é uma conveniência, não pode atrapalhar o salvamento */
  }
}
