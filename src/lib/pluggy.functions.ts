import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração Pluggy (Open Finance). Fase de teste: SOMENTE o administrador
 * principal. As credenciais ficam nas variáveis de ambiente do servidor
 * (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET) e nunca vão para o navegador.
 * Aqui só se guarda o id da conexão (item); nenhuma senha bancária passa por nós.
 */
const BASE = "https://api.pluggy.ai";

async function exigirPrincipal(userId: string) {
  const { ehAdminPrincipal } = await import("@/lib/conta-exclusao.server");
  if (!(await ehAdminPrincipal(userId))) throw new Error("Recurso em teste, restrito ao administrador principal.");
}

function credenciais() {
  const clientId = process.env["PLUGGY_CLIENT_ID"];
  const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function apiKey(): Promise<string> {
  const c = credenciais();
  if (!c) throw new Error("Credenciais da Pluggy não configuradas no servidor.");
  const r = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
  if (!r.ok) throw new Error("A Pluggy recusou as credenciais.");
  const j = (await r.json()) as { apiKey?: string };
  if (!j.apiKey) throw new Error("Resposta inesperada da Pluggy.");
  return j.apiKey;
}

async function pluggy<T>(key: string, caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { "X-API-KEY": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`Falha ao consultar a Pluggy (${r.status}).`);
  return (await r.json()) as T;
}

export const pluggyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    return { configurado: !!credenciais() };
  });

/** Gera o token de uso único do widget Pluggy Connect (vale por poucos minutos). */
export const pluggyCriarConnectToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const key = await apiKey();
    const j = await pluggy<{ accessToken: string }>(key, "/connect_token", {
      method: "POST",
      body: JSON.stringify({ options: { clientUserId: context.userId, avoidDuplicates: true } }),
    });
    return { accessToken: j.accessToken };
  });

export const pluggyRegistrarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ itemId: z.string().uuid(), conector: z.string().max(120).optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("pluggy_items").upsert(
      {
        user_id: context.userId,
        item_id: data.itemId,
        conector: data.conector ?? null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );
    if (error) throw new Error("Não foi possível guardar a conexão.");
    return { ok: true as const };
  });

export const pluggyListarItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("pluggy_items")
      .select("id,item_id,conector,status,criado_em")
      .eq("user_id", context.userId)
      .order("criado_em", { ascending: false });
    return { itens: (data ?? []) as { id: string; item_id: string; conector: string | null; status: string | null; criado_em: string }[] };
  });

export const pluggyRemoverItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ itemId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: meu } = await db
      .from("pluggy_items")
      .select("id")
      .eq("item_id", data.itemId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!meu) throw new Error("Conexão não encontrada.");
    try {
      const key = await apiKey();
      await fetch(`${BASE}/items/${data.itemId}`, { method: "DELETE", headers: { "X-API-KEY": key } });
    } catch {
      /* se a Pluggy falhar, ainda removemos o vínculo local */
    }
    await db.from("pluggy_items").delete().eq("item_id", data.itemId).eq("user_id", context.userId);
    return { ok: true as const };
  });

type Conta = {
  id: string;
  type: string;
  subtype: string;
  name: string;
  number?: string;
  balance: number;
  currencyCode: string;
};
type Transacao = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  status?: string;
};

/** Contas e movimentos dos últimos N dias (somente leitura, nada é gravado no site). */
export const pluggyBuscarMovimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ itemId: z.string().uuid(), dias: z.number().int().min(1).max(90).default(30) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: meu } = await (supabaseAdmin as any)
      .from("pluggy_items")
      .select("id")
      .eq("item_id", data.itemId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!meu) throw new Error("Conexão não encontrada.");
    const key = await apiKey();
    const item = await pluggy<{ status?: string }>(key, `/items/${data.itemId}`);
    await (supabaseAdmin as any)
      .from("pluggy_items")
      .update({ status: item.status ?? null, atualizado_em: new Date().toISOString() })
      .eq("item_id", data.itemId);
    const contas = await pluggy<{ results: Conta[] }>(key, `/accounts?itemId=${data.itemId}`);
    const de = new Date(Date.now() - data.dias * 86400000).toISOString();
    const saida: { conta: Conta; transacoes: Transacao[] }[] = [];
    for (const conta of contas.results ?? []) {
      const transacoes: Transacao[] = [];
      let depois: string | null = null;
      for (let pagina = 0; pagina < 10; pagina++) {
        const qs = new URLSearchParams({ accountId: conta.id, dateFrom: de });
        if (depois) qs.set("after", depois);
        const r: { results: Transacao[]; next: string | null } = await pluggy(key, `/v2/transactions?${qs.toString()}`);
        transacoes.push(...(r.results ?? []));
        if (!r.next) break;
        const m = /after=([^&]+)/.exec(r.next);
        depois = m ? decodeURIComponent(m[1]!) : null;
        if (!depois) break;
      }
      saida.push({ conta, transacoes });
    }
    return { status: item.status ?? null, contas: saida };
  });
