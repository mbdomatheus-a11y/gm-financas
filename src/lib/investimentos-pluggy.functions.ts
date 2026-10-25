import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Liga um investimento importado pelo Open Finance a um que a pessoa já tinha cadastrado à mão
 * (pedido de 24/10/2026): o cadastrado passa a receber o valor atual do banco e a linha importada
 * sai, para não contar duas vezes. Usa as regras de acesso (RLS) de quem pede.
 */
export const vincularInvestimentoImportado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ importadoId: z.string().uuid(), manualId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.importadoId === data.manualId) throw new Error("Escolha outro investimento.");
    const { data: linhas } = await sb
      .from("investimentos")
      .select("id, origem, pluggy_investimento_id, valor_atual, grupo_id")
      .in("id", [data.importadoId, data.manualId]);
    const importado = (linhas ?? []).find((l: any) => l.id === data.importadoId);
    const manual = (linhas ?? []).find((l: any) => l.id === data.manualId);
    if (!importado || !manual) throw new Error("Investimento não encontrado.");
    if (importado.origem !== "pluggy" || !importado.pluggy_investimento_id)
      throw new Error("O primeiro investimento não veio do Open Finance.");
    if (manual.pluggy_investimento_id) throw new Error("Este investimento já está ligado ao banco.");
    if (importado.grupo_id !== manual.grupo_id) throw new Error("Investimentos de grupos diferentes.");

    // A chave da Pluggy é única: sai da linha importada antes de ir para a cadastrada.
    const { data: apagado, error: e1 } = await sb.from("investimentos").delete().eq("id", importado.id).select("id");
    if (e1 || !apagado?.length) throw new Error("Não foi possível ligar os investimentos.");
    const { error: e2 } = await sb
      .from("investimentos")
      .update({
        origem: "pluggy",
        pluggy_investimento_id: importado.pluggy_investimento_id,
        valor_atual: importado.valor_atual,
      })
      .eq("id", manual.id);
    if (e2) throw new Error("Não foi possível ligar os investimentos. Sincronize de novo para recriar o importado.");
    return { ok: true as const };
  });
