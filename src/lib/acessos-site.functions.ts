import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Log de acessos ao site (2026-10-06): IP e local aproximado (cabeçalhos da
 * Vercel, sem serviço externo), origem (UTM/referrer) e dispositivo, para o
 * admin medir se as ações de CRM/divulgação trouxeram mais fluxo. Só a
 * service_role grava e lê a tabela; a leitura passa por checagem de admin.
 * IP é dado pessoal (LGPD): informado na Política de Privacidade e usado só
 * para segurança e estatística.
 */

const decodificar = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

export const registrarAcessoSite = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z
      .object({
        caminho: z.string().max(300),
        referrer: z.string().max(300).nullish(),
        utmSource: z.string().max(80).nullish(),
        utmMedium: z.string().max(80).nullish(),
        utmCampaign: z.string().max(120).nullish(),
        sessao: z.string().max(64).nullish(),
        token: z.string().max(4000).nullish(),
        /** Aceite de cookies de métricas. Sem ele, só registra quem está logado e sem IP/local. */
        metricas: z.boolean().optional(),
        plataforma: z.enum(["site", "app"]).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    try {
      const h = getRequest().headers;
      const ua = h.get("user-agent") ?? "";
      if (/bot|crawl|spider|preview|headless|lighthouse|vercel/i.test(ua)) return { ok: true };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const dispositivo = /ipad|tablet/i.test(ua)
        ? "tablet"
        : /mobi|android|iphone/i.test(ua)
          ? "celular"
          : "computador";
      // Usuário logado: o servidor confere o token (o navegador não informa o id direto).
      let userId: string | null = null;
      if (data.token) {
        const { data: u } = await (supabaseAdmin as any).auth.getUser(data.token);
        userId = u?.user?.id ?? null;
      }
      // 27/10/2026: tela aberta por quem está logado entra sempre no log (só o caminho, para o resumo
      // de uso); IP, local e navegador só com o aceite de métricas. Visitante sem aceite não entra.
      const comMetricas = data.metricas !== false;
      if (!comMetricas && !userId) return { ok: true };
      await (supabaseAdmin as any).from("acessos_site_log").insert({
        caminho: data.caminho,
        referrer: comMetricas ? (data.referrer ?? null) : null,
        utm_source: comMetricas ? (data.utmSource ?? null) : null,
        utm_medium: comMetricas ? (data.utmMedium ?? null) : null,
        utm_campaign: comMetricas ? (data.utmCampaign ?? null) : null,
        ip: comMetricas ? h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null : null,
        cidade: comMetricas ? decodificar(h.get("x-vercel-ip-city")) : null,
        regiao: comMetricas ? decodificar(h.get("x-vercel-ip-country-region")) : null,
        pais: comMetricas ? h.get("x-vercel-ip-country") : null,
        user_agent: comMetricas ? ua.slice(0, 300) || null : null,
        dispositivo,
        sessao: data.sessao ?? null,
        user_id: userId,
        plataforma: data.plataforma ?? "site",
      });
    } catch {
      // Telemetria nunca atrapalha a navegação.
    }
    return { ok: true };
  });

export type AcessoSite = {
  id: string;
  criado_em: string;
  caminho: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ip: string | null;
  cidade: string | null;
  regiao: string | null;
  pais: string | null;
  dispositivo: string | null;
  sessao: string | null;
  user_id: string | null;
  user_agent: string | null;
  plataforma: string | null;
  /** Nome da pessoa (só para o resumo de uso do admin). */
  nome?: string | null;
};

export const adminListarAcessos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ dias: z.number().int().min(1).max(365) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: adm } = await db
      .from("site_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!adm) throw new Error("Acesso restrito à administração do site.");
    const desde = new Date(Date.now() - data.dias * 86_400_000).toISOString();
    // O Supabase devolve no máximo 1.000 linhas por consulta: antes o painel mostrava
    // "1000 páginas vistas" fixo. Agora busca em páginas de 1.000 até acabar.
    const todos: AcessoSite[] = [];
    for (let de = 0; de < 100_000; de += 1000) {
      const { data: rows, error } = await db
        .from("acessos_site_log")
        .select(
          "id,criado_em,caminho,referrer,utm_source,utm_medium,utm_campaign,ip,cidade,regiao,pais,dispositivo,sessao,user_id,user_agent,plataforma",
        )
        .gte("criado_em", desde)
        .order("criado_em", { ascending: false })
        .range(de, de + 999);
      if (error) throw new Error("Não foi possível carregar os acessos.");
      todos.push(...((rows ?? []) as AcessoSite[]));
      if (!rows || rows.length < 1000) break;
    }
    const ids = [...new Set(todos.map((a) => a.user_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: perfis } = await db.from("profiles").select("id,nome").in("id", ids);
      const nomes = new Map<string, string>((perfis ?? []).map((p: any) => [String(p.id), String(p.nome ?? "")]));
      for (const a of todos) a.nome = a.user_id ? (nomes.get(a.user_id) ?? null) : null;
    }
    return todos;
  });
