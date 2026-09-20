import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/descarte-layouts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Não autorizado", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data: vencidos, error } = await db
          .from("layout_solicitacoes")
          .select("id,user_id,arquivo_path")
          .lte("prazo_exclusao", new Date().toISOString())
          .in("status", ["recebida", "em_modelagem"])
          .limit(100);
        if (error) return new Response("Falha ao consultar a fila", { status: 500 });

        let descartados = 0;
        for (const item of vencidos ?? []) {
          const { error: arquivoError } = await db.storage
            .from("layouts_analise")
            .remove([item.arquivo_path]);
          if (arquivoError) continue;
          const { error: registroError } = await db
            .from("layout_solicitacoes")
            .update({ status: "descartada", atualizado_em: new Date().toISOString() })
            .eq("id", item.id);
          if (registroError) continue;
          await db.from("admin_audit_logs").insert({
            acao: "layout_descartado_por_prazo",
            alvo_id: item.user_id,
            detalhes: { solicitacao_id: item.id },
          });
          descartados++;
        }
        return Response.json({ descartados });
      },
    },
  },
});
