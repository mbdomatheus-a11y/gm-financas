import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_despesas",
  title: "Listar despesas",
  description: "Lista despesas recentes do casal, com filtro opcional por categoria.",
  inputSchema: {
    categoria: z.string().optional().describe("Categoria exata para filtrar."),
    limite: z.number().int().min(1).max(100).optional().describe("Quantidade de resultados, de 1 a 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ categoria, limite }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const quantidade = Math.min(100, Math.max(1, limite ?? 20));
    let query = supabase
      .from("despesas")
      .select(
        "id, descricao, valor_total, moeda, categoria, tipo, data_compra, total_parcelas, responsavel",
      )
      .order("data_compra", { ascending: false })
      .limit(quantidade);
    if (categoria?.trim()) query = query.eq("categoria", categoria.trim());
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { despesas: data },
    };
  },
});
