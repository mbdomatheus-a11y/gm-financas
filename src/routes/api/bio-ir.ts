import { createFileRoute } from "@tanstack/react-router";

/**
 * Clique num link da página da bio (19/11/2026): registra o clique e manda para o destino (302).
 * GET /api/bio-ir?l=<id do link>&m=1|0&s=<sessão>&r=<origem>&us=&um=&uc=
 * m=1 só com o aceite de cookies de métricas: aí guarda origem, campanha, local, IP e navegador,
 * igual ao registro de acessos do site. Sem aceite, só o clique e o tipo de aparelho.
 * Só redireciona para links cadastrados e ativos (nunca para um endereço vindo da URL).
 */
const corta = (v: string | null, n: number) => (v ? v.slice(0, n) : null);

export const Route = createFileRoute("/api/bio-ir")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const id = u.searchParams.get("l") ?? "";
        const voltar = new Response(null, { status: 302, headers: { location: "/", "cache-control": "no-store" } });
        if (!/^[0-9a-f-]{36}$/i.test(id)) return voltar;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data: link } = await db.from("bio_links").select("id,url,pagina_id,ativo").eq("id", id).maybeSingle();
        if (!link || !link.ativo || !/^https?:\/\//.test(link.url)) return voltar;
        try {
          const metricas = u.searchParams.get("m") === "1";
          const { dadosDaRequisicao } = await import("@/lib/bio.server");
          const { robo, campos } = dadosDaRequisicao(metricas);
          if (!robo) {
            await db.from("bio_eventos").insert({
              pagina_id: link.pagina_id,
              link_id: link.id,
              tipo: "clique",
              metricas,
              referrer: metricas ? corta(u.searchParams.get("r"), 300) : null,
              utm_source: metricas ? corta(u.searchParams.get("us"), 80) : null,
              utm_medium: metricas ? corta(u.searchParams.get("um"), 80) : null,
              utm_campaign: metricas ? corta(u.searchParams.get("uc"), 120) : null,
              sessao: metricas ? corta(u.searchParams.get("s"), 64) : null,
              ...campos,
            });
          }
        } catch {
          // o clique sempre segue para o destino
        }
        return new Response(null, { status: 302, headers: { location: link.url, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
      },
    },
  },
});
