import { createFileRoute } from "@tanstack/react-router";

/**
 * Chamado pelo banco (pg_net, gatilhos da migration 20261108120000) logo depois de gravar:
 * - { ids }: avisos novos em notificacoes_usuario, push na hora (respeitando as preferências);
 * - { grupos }: lançamento novo, confere os limites de gastos desses grupos.
 * Usa o mesmo CRON_SECRET das rotas de cron (guardado em private.push_config no banco).
 */
export const Route = createFileRoute("/api/push/despachar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { autorizado, conferirLimites, despacharAvisos } = await import("@/lib/avisos.server");
        if (!autorizado(request)) return new Response("Não autorizado", { status: 401 });
        const corpo = (await request.json().catch(() => ({}))) as { ids?: unknown; grupos?: unknown };
        const uuids = (v: unknown) =>
          Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const grupos = uuids(corpo.grupos);
        // Limite: os avisos gravados disparam outra chamada com { ids }; nada a despachar aqui.
        if (grupos.length) return Response.json({ limites: await conferirLimites(db, grupos) });
        const ids = uuids(corpo.ids);
        if (!ids.length) return Response.json({ enviados: 0 });
        return Response.json(await despacharAvisos(db, ids));
      },
    },
  },
});
