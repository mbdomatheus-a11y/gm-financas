import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Página de links ("link na bio"), 19/11/2026. Fica em /bio/<nome>, só por link direto: não aparece no menu
 * do site nem no app, e não é indexada. Só o admin do site edita (Administração > Links da bio).
 * Visitas e cliques guardam os mesmos dados do registro de acessos do site, com a mesma regra da LGPD:
 * origem, local, IP e navegador só com o aceite de cookies de métricas; sem aceite, só a contagem e o aparelho.
 */

const decodificar = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

/** Dados da requisição para o evento (mesma regra de acessos_site_log). */
export function dadosDaRequisicao(metricas: boolean) {
  const h = getRequest().headers;
  const ua = h.get("user-agent") ?? "";
  const robo = /bot|crawl|spider|preview|headless|lighthouse|vercel|facebookexternalhit|whatsapp|telegram|slack/i.test(ua);
  const dispositivo = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "celular" : "computador";
  return {
    robo,
    campos: {
      ip: metricas ? h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null : null,
      cidade: metricas ? decodificar(h.get("x-vercel-ip-city")) : null,
      regiao: metricas ? decodificar(h.get("x-vercel-ip-country-region")) : null,
      pais: metricas ? h.get("x-vercel-ip-country") : null,
      user_agent: metricas ? ua.slice(0, 300) || null : null,
      dispositivo,
    },
  };
}

const urlFoto = (path: string | null) => {
  if (!path) return null;
  const base = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/site_assets/${path}`;
};

/** Página pública (só ativa) com os links ativos em ordem. */
export const obterBioPublica = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{2,40}$/).optional() }).parse(v))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // 19/11/2026: o endereço público é só controlall.com.br/bio (a primeira página no ar).
    let q = db.from("bio_paginas").select("id,slug,titulo,bio,foto_path").eq("ativo", true);
    q = data.slug ? q.eq("slug", data.slug) : q.order("criado_em").limit(1);
    const { data: pagina } = await q.maybeSingle();
    if (!pagina) return null;
    const { data: links } = await db.from("bio_links").select("id,titulo,url").eq("pagina_id", pagina.id).eq("ativo", true).order("ordem");
    return { slug: pagina.slug, titulo: pagina.titulo, bio: pagina.bio, foto: urlFoto(pagina.foto_path), links: links ?? [] };
  });

const campoOrigem = {
  referrer: z.string().max(300).nullish(),
  utmSource: z.string().max(80).nullish(),
  utmMedium: z.string().max(80).nullish(),
  utmCampaign: z.string().max(120).nullish(),
  sessao: z.string().max(64).nullish(),
  metricas: z.boolean(),
};

/** Registra a visita à página. Telemetria nunca atrapalha a página. */
export const registrarVisitaBio = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{2,40}$/), ...campoOrigem }).parse(v))
  .handler(async ({ data }) => {
    try {
      const { robo, campos } = dadosDaRequisicao(data.metricas);
      if (robo) return { ok: true };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { aplicarLimitePorIp } = await import("@/lib/rate-limit.server");
      await aplicarLimitePorIp(db, "bio-visita", 60, 10);
      const { data: pagina } = await db.from("bio_paginas").select("id").eq("slug", data.slug).eq("ativo", true).maybeSingle();
      if (!pagina) return { ok: true };
      await db.from("bio_eventos").insert({
        pagina_id: pagina.id,
        tipo: "visita",
        metricas: data.metricas,
        referrer: data.metricas ? (data.referrer ?? null) : null,
        utm_source: data.metricas ? (data.utmSource ?? null) : null,
        utm_medium: data.metricas ? (data.utmMedium ?? null) : null,
        utm_campaign: data.metricas ? (data.utmCampaign ?? null) : null,
        sessao: data.metricas ? (data.sessao ?? null) : null,
        ...campos,
      });
    } catch {
      // segue sem registrar
    }
    return { ok: true };
  });

// ---------------------------------------------------------------- administração (só admin do site)

async function exigirAdminSite(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

export const adminBioObter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ dias: z.number().int().min(1).max(365) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdminSite(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: paginas, error } = await db.from("bio_paginas").select("*").order("criado_em");
    if (error) throw new Error("Rode o SQL docs/sql/2026-11-19-bio-links.sql para usar os links da bio.");
    const ids = (paginas ?? []).map((p: any) => p.id);
    const { data: links } = ids.length ? await db.from("bio_links").select("*").in("pagina_id", ids).order("ordem") : { data: [] };
    const desde = new Date(Date.now() - data.dias * 86_400_000).toISOString();
    const eventos: any[] = [];
    for (let i = 0; ids.length && i < 20; i++) {
      const { data: lote } = await db
        .from("bio_eventos")
        .select("id,pagina_id,link_id,tipo,metricas,referrer,utm_source,utm_medium,utm_campaign,ip,cidade,regiao,pais,user_agent,dispositivo,sessao,criado_em")
        .in("pagina_id", ids)
        .gte("criado_em", desde)
        .order("criado_em", { ascending: false })
        .range(i * 1000, i * 1000 + 999);
      eventos.push(...(lote ?? []));
      if (!lote || lote.length < 1000) break;
    }
    return {
      paginas: (paginas ?? []).map((p: any) => ({ ...p, foto: urlFoto(p.foto_path) })),
      links: links ?? [],
      eventos,
    };
  });

export const adminBioSalvarPagina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, "Use de 2 a 40 letras minúsculas, números ou hífen."),
        titulo: z.string().trim().max(80),
        bio: z.string().trim().max(300),
        ativo: z.boolean(),
        foto_path: z.string().regex(/^bio\/[A-Za-z0-9._-]+$/).nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdminSite(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const linha: Record<string, unknown> = { slug: data.slug, titulo: data.titulo, bio: data.bio, ativo: data.ativo, atualizado_em: new Date().toISOString() };
    if (data.foto_path !== undefined) linha["foto_path"] = data.foto_path;
    const r = data.id ? await db.from("bio_paginas").update(linha).eq("id", data.id).select("id").single() : await db.from("bio_paginas").insert(linha).select("id").single();
    if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? "Esse endereço já está em uso." : r.error.message);
    return { id: r.data.id as string };
  });

export const adminBioPrepararFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ nome: z.string().min(1).max(140) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdminSite(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `bio/${crypto.randomUUID()}-${data.nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60)}`;
    const { data: signed, error } = await (supabaseAdmin as any).storage.from("site_assets").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token as string };
  });

export const adminBioSalvarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        pagina_id: z.string().uuid(),
        titulo: z.string().trim().min(1, "Dê um nome ao link.").max(80),
        url: z.string().trim().url("Endereço inválido.").regex(/^https?:\/\//, "Use um endereço que comece com https://"),
        ativo: z.boolean(),
        ordem: z.number().int().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdminSite(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    if (data.id) {
      const { error } = await db.from("bio_links").update({ titulo: data.titulo, url: data.url, ativo: data.ativo }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { data: ult } = await db.from("bio_links").select("ordem").eq("pagina_id", data.pagina_id).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("bio_links").insert({ pagina_id: data.pagina_id, titulo: data.titulo, url: data.url, ativo: data.ativo, ordem: (ult?.ordem ?? -1) + 1 });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminBioOrdenarLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdminSite(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    await Promise.all(data.ids.map((id, ordem) => db.from("bio_links").update({ ordem }).eq("id", id)));
    return { ok: true as const };
  });

export const adminBioExcluirLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdminSite(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("bio_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
