import { createFileRoute } from "@tanstack/react-router";

/**
 * Avisos de data (08/11/2026): parcela e fatura vencendo, fatura fechando, garantia acabando.
 * Gera os que entraram na janela e entrega os pushes guardados para o início da janela de horário.
 * Lê public.config_alertas (liga/desliga, antecedência, frequência): ver docs/alertas.md.
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
  // Tipos agregados (config_alertas com frequência diferente de "na hora"): resumo no dia/hora configurados.
  const { despacharLotes } = await import("@/lib/avisos.server");
  const lotes = await despacharLotes(db).catch(() => ({ resumos: 0, lote: 0 }));
  return Response.json({ gerados, ...r, ...lotes });
}

export const Route = createFileRoute("/api/cron/alertas")({
  server: {
    handlers: {
      GET: ({ request }) => executar(request),
      POST: ({ request }) => executar(request),
    },
  },
});
