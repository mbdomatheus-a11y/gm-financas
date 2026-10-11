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
    // Transferências e pagamentos entre pessoas não viram regra: o nome da pessoa não deve ser guardado.
    if (/\b(PIX|TED|DOC|TRANSF|TRANSFERENCIA|SAQUE|BOLETO)\b/i.test(p.descricao)) return;
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

const PADRAO_NAO_LEMBRAR = /\b(PIX|TED|DOC|TRANSF|TRANSFERENCIA|SAQUE|BOLETO)\b/i;

/**
 * Grava de uma vez a classificação confirmada na importação (uma linha por
 * estabelecimento). Fica no grupo da conta, nunca entre grupos diferentes.
 * Transferências e pagamentos a pessoas não entram, porque o nome do
 * favorecido é dado pessoal de terceiro.
 */
export async function lembrarClassificacoes(
  grupoId: string,
  userId: string,
  itens: { descricao: string; categoria: string; subcategoria: string | null; tipo: string }[],
): Promise<void> {
  const porChave = new Map<string, (typeof itens)[number]>();
  for (const it of itens) {
    const chave = chaveEstabelecimento(it.descricao);
    if (!chave || !it.categoria || PADRAO_NAO_LEMBRAR.test(it.descricao)) continue;
    porChave.set(chave, it);
  }
  if (porChave.size === 0) return;
  const agora = new Date().toISOString();
  const { error } = await supabase.from("importacao_preferencias").upsert(
    [...porChave].map(([chave, it]) => ({
      grupo_id: grupoId,
      chave,
      escopo: "classificacao",
      acao: JSON.stringify({ categoria: it.categoria, subcategoria: it.subcategoria, tipo: it.tipo }),
      criado_por: userId,
      atualizado_em: agora,
    })),
    { onConflict: "grupo_id,chave,escopo" },
  );
  if (error) throw error;
}
