import { createFileRoute } from "@tanstack/react-router";

/**
 * Logos dos bancos (14/11/2026): renova os automáticos com mais de 6 dias (origem admin nunca muda).
 * Chamado todo dia pelo pg_cron (private.chamar_servidor, POST); cada banco acaba renovado uma vez por semana.
 */
async function executar(request: Request) {
  const { autorizado } = await import("@/lib/avisos.server");
  if (!autorizado(request)) return new Response("Não autorizado", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { atualizarLogosAutomaticos } = await import("@/lib/logos-bancos.server");
  const r = await atualizarLogosAutomaticos(supabaseAdmin as any);
  return Response.json(r);
}

export const Route = createFileRoute("/api/cron/logos-bancos")({
  server: {
    handlers: {
      GET: ({ request }) => executar(request),
      POST: ({ request }) => executar(request),
    },
  },
});
