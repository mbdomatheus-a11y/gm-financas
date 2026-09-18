import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_investimentos",
  title: "Listar investimentos",
  description: "Consulta a carteira de investimentos e seus valores atuais.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("investimentos")
      .select("id, nome, tipo, instituicao, valor_investido, valor_atual, data_investimento, responsavel")
      .order("valor_atual", { ascending: false });
    if (error) throw new ToolError(error.message);
    const totalInvestido = data.reduce((total, item) => total + Number(item.valor_investido), 0);
    const valorAtual = data.reduce((total, item) => total + Number(item.valor_atual), 0);
    const resultado = { totalInvestido, valorAtual, rendimento: valorAtual - totalInvestido, investimentos: data };
    return {
      content: [{ type: "text", text: JSON.stringify(resultado) }],
      structuredContent: resultado,
    };
  },
});