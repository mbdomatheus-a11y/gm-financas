import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Banner de oferta com contador na home pública.
 * Janela fixa (início e fim gravados). Nunca reinicia sozinha:
 * para nova campanha o admin grava novas datas.
 */

const DURACAO_MAX_HORAS = 24 * 90; // até 90 dias

/** Leitura pública (home sem login). Devolve só o que a home precisa. */
export const obterBannerOferta = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("configuracoes_acesso_site")
    .select("banner_oferta_ativo, banner_oferta_inicio, banner_oferta_fim")
    .eq("id", true)
    .maybeSingle();

  const agora = Date.now();
  const inicio = data?.banner_oferta_inicio ? Date.parse(data.banner_oferta_inicio) : null;
  const fim = data?.banner_oferta_fim ? Date.parse(data.banner_oferta_fim) : null;
  const exibir =
    Boolean(data?.banner_oferta_ativo) &&
    inicio !== null &&
    fim !== null &&
    agora >= inicio &&
    agora < fim;

  return {
    exibir,
    fim: exibir ? new Date(fim as number).toISOString() : null,
  };
});

/** Leitura para o admin: valores gravados, sem filtro de tempo. */
export const adminObterBannerOferta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: souAdmin } = await db
      .from("site_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!souAdmin) throw new Error("Acesso restrito à administração do site.");
    const { data } = await db
      .from("configuracoes_acesso_site")
      .select("banner_oferta_ativo, banner_oferta_inicio, banner_oferta_fim")
      .eq("id", true)
      .maybeSingle();
    return {
      ativo: Boolean(data?.banner_oferta_ativo),
      inicio: (data?.banner_oferta_inicio ?? null) as string | null,
      fim: (data?.banner_oferta_fim ?? null) as string | null,
    };
  });

export const adminSalvarBannerOferta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        ativo: z.boolean(),
        inicio: z.string().datetime().nullable(),
        duracaoHoras: z.number().int().min(1).max(DURACAO_MAX_HORAS).nullable(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: souAdmin } = await db
      .from("site_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!souAdmin) throw new Error("Acesso restrito à administração do site.");

    let inicioIso: string | null = null;
    let fimIso: string | null = null;
    if (data.inicio && data.duracaoHoras) {
      const inicio = Date.parse(data.inicio);
      inicioIso = new Date(inicio).toISOString();
      fimIso = new Date(inicio + data.duracaoHoras * 3_600_000).toISOString();
      if (data.ativo && Date.parse(fimIso) <= Date.now()) {
        throw new Error("Essa janela já terminou. Defina um novo início e uma duração.");
      }
    }
    if (data.ativo && (!inicioIso || !fimIso)) {
      throw new Error("Para ligar o banner, informe o início e a duração total.");
    }

    const { error } = await db
      .from("configuracoes_acesso_site")
      .update({
        banner_oferta_ativo: data.ativo,
        banner_oferta_inicio: inicioIso,
        banner_oferta_fim: fimIso,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "banner_oferta_atualizado",
      detalhes: { ativo: data.ativo, inicio: inicioIso, fim: fimIso },
    });
    return { ok: true as const, fim: fimIso };
  });
