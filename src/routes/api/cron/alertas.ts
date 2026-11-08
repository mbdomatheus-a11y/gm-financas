import { createFileRoute } from "@tanstack/react-router";

/**
 * Avisos de data (08/11/2026): parcela e fatura vencendo, fatura fechando, garantia acabando.
 * Gera os que entraram na janela e entrega os pushes guardados para o início da janela de horário.
 * Chamado de hora em hora pelo pg_cron do Supabase (POST) e uma vez por dia pela Vercel (GET, rede de segurança).
 */
async function executar(request: Request) {
  const { autorizado, despacharAvisos, gerarAvisosDeData } = await import("@/lib/avisos.server");
  if (!autorizado(request)) return new Response("Não autorizado", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const gerados = await gerarAvisosDeData(db).catch(() => 0);
  // Sem ids: pega também pendentes que o gatilho não conseguiu entregar (pg_net fora do ar).
  const r = await despacharAvisos(db);
  return Response.json({ gerados, ...r });
}

export const Route = createFileRoute("/api/cron/alertas")({
  server: {
    handlers: {
      GET: ({ request }) => executar(request),
      POST: ({ request }) => executar(request),
    },
  },
});
