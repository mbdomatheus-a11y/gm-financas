import { createFileRoute } from "@tanstack/react-router";

/**
 * Rede de segurança da integração Pluggy: atualiza todas as conexões de hora em hora,
 * caso algum aviso de webhook tenha se perdido. Usa o mesmo CRON_SECRET das demais rotas de cron.
 */
export const Route = createFileRoute("/api/cron/pluggy-sincronizar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Não autorizado", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sincronizarItem } = await import("@/lib/pluggy-api.server");
        const { data: itens, error } = await (supabaseAdmin as any).from("pluggy_items").select("item_id");
        if (error) return new Response("Falha ao listar conexões", { status: 500 });

        let ok = 0;
        let falhas = 0;
        for (const { item_id } of itens ?? []) {
          try {
            await sincronizarItem(item_id);
            ok++;
          } catch {
            falhas++;
          }
        }
        return Response.json({ conexoes: (itens ?? []).length, ok, falhas });
      },
    },
  },
});
