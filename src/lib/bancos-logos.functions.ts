import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chaveBanco, type LogoBanco } from "@/lib/bancos-logos";

const VALIDADE_MS = 7 * 24 * 3600_000;
const ORDEM_TIPO: Record<string, number> = { PERSONAL_BANK: 0, BUSINESS_BANK: 1, INVESTMENT: 2 };

/**
 * Catálogo de logos oficiais dos bancos (28/10/2026). Lê a tabela bancos_logos; se estiver vazia ou com
 * mais de 7 dias, renova pela lista de instituições da Pluggy (todas do Brasil, não só as conectadas).
 */
export const catalogoLogosBancos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LogoBanco[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: atuais } = await db.from("bancos_logos").select("chave, nome, logo_url, cor, atualizado_em");
    const lista = (atuais ?? []) as (LogoBanco & { atualizado_em: string })[];
    const maisNovo = lista.reduce((m, l) => Math.max(m, new Date(l.atualizado_em).getTime()), 0);
    if (lista.length > 0 && Date.now() - maisNovo < VALIDADE_MS) return lista;
    try {
      const { chaveApi } = await import("@/lib/pluggy-api.server");
      const key = await chaveApi();
      const r = await fetch("https://api.pluggy.ai/connectors?countries=BR", { headers: { "X-API-KEY": key } });
      if (!r.ok) return lista;
      const j = (await r.json()) as {
        results?: { name?: string; imageUrl?: string; primaryColor?: string; type?: string; isSandbox?: boolean }[];
      };
      const porChave = new Map<string, { chave: string; nome: string; logo_url: string; cor: string | null; tipo: string | null; ordem: number }>();
      for (const c of j.results ?? []) {
        if (c.isSandbox || !c.name || !c.imageUrl) continue;
        const ordem = ORDEM_TIPO[c.type ?? ""] ?? 9;
        if (ordem === 9) continue;
        const chave = chaveBanco(c.name.replace(/\b(pf|pj|empresas?|business)\b/gi, " "));
        if (!chave) continue;
        const atual = porChave.get(chave);
        if (atual && atual.ordem <= ordem) continue;
        porChave.set(chave, {
          chave,
          nome: c.name,
          logo_url: c.imageUrl,
          cor: c.primaryColor ? `#${c.primaryColor.replace(/^#/, "")}` : null,
          tipo: c.type ?? null,
          ordem,
        });
      }
      const linhas = [...porChave.values()].map(({ ordem: _o, ...l }) => ({ ...l, atualizado_em: new Date().toISOString() }));
      if (linhas.length) await db.from("bancos_logos").upsert(linhas, { onConflict: "chave" });
      return linhas;
    } catch {
      return lista;
    }
  });
