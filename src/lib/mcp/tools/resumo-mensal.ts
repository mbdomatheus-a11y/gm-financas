import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

function intervaloMes(competencia?: string) {
  const base = competencia ? new Date(`${competencia}-01T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) throw new ToolError("Competência inválida. Use AAAA-MM.");
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth();
  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const fim = new Date(Date.UTC(ano, mes + 1, 1)).toISOString().slice(0, 10);
  return { inicio, fim, competencia: inicio.slice(0, 7) };
}

export default defineTool({
  name: "consultar_resumo_mensal",
  title: "Consultar resumo mensal",
  description: "Consulta receitas, despesas e saldo de uma competência mensal do casal.",
  inputSchema: {
    competencia: z.string().optional().describe("Mês no formato AAAA-MM; omita para o mês atual."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ competencia }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const periodo = intervaloMes(competencia);
    const [receitasResult, despesasResult] = await Promise.all([
      supabase
        .from("receitas")
        .select("valor, moeda")
        .gte("data_recebimento", periodo.inicio)
        .lt("data_recebimento", periodo.fim),
      supabase
        .from("despesas")
        .select("valor_total, moeda, direcao")
        .gte("data_primeira_parcela", periodo.inicio)
        .lt("data_primeira_parcela", periodo.fim),
    ]);
    if (receitasResult.error) throw new ToolError(receitasResult.error.message);
    if (despesasResult.error) throw new ToolError(despesasResult.error.message);

    const receitas = receitasResult.data.reduce((total, item) => total + Number(item.valor), 0);
    const despesas = despesasResult.data.reduce(
      (total, item) =>
        total + (item.direcao === "credito" ? -Number(item.valor_total) : Number(item.valor_total)),
      0,
    );
    const resumo = {
      competencia: periodo.competencia,
      receitas,
      despesas,
      saldo: receitas - despesas,
      moeda: "BRL",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(resumo) }],
      structuredContent: resumo,
    };
  },
});
