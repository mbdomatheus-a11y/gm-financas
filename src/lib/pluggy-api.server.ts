/**
 * Cliente da API da Pluggy e sincronização de um item, só no servidor.
 * As credenciais vêm de PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET e nunca vão ao navegador.
 * Nenhuma senha bancária passa por aqui: a conexão é feita no widget da Pluggy.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://api.pluggy.ai";
const JANELA_DIAS = 90;

type Conta = { id: string; type?: string; subtype?: string; name?: string; balance?: number; currencyCode?: string };
type Transacao = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  status?: string;
  accountId?: string;
};

export async function chaveApi(): Promise<string> {
  const clientId = process.env["PLUGGY_CLIENT_ID"];
  const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Credenciais da Pluggy não configuradas no servidor.");
  const r = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!r.ok) throw new Error("A Pluggy recusou as credenciais.");
  const j = (await r.json()) as { apiKey?: string };
  if (!j.apiKey) throw new Error("Resposta inesperada da Pluggy.");
  return j.apiKey;
}

async function pluggy<T>(key: string, caminho: string): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, { headers: { "X-API-KEY": key } });
  if (!r.ok) throw new Error(`Falha ao consultar a Pluggy (${r.status}).`);
  return (await r.json()) as T;
}

/**
 * Atualiza um item: status, contas e lançamentos dos últimos 90 dias.
 * Idempotente: grava com upsert pelo ID da transação da Pluggy, então rodar de novo não duplica.
 * Só processa itens que já estão em pluggy_items (qualquer outro ID é ignorado).
 */
export async function sincronizarItem(itemId: string): Promise<{ ignorado: boolean; transacoes: number }> {
  const { data: meu, error: erroItem } = await (supabaseAdmin as any)
    .from("pluggy_items")
    .select("user_id")
    .eq("item_id", itemId)
    .maybeSingle();
  if (erroItem) throw new Error("Falha ao consultar a conexão.");
  if (!meu) return { ignorado: true, transacoes: 0 };

  const key = await chaveApi();
  const item = await pluggy<{ status?: string }>(key, `/items/${itemId}`);
  await (supabaseAdmin as any)
    .from("pluggy_items")
    .update({ status: item.status ?? null, atualizado_em: new Date().toISOString() })
    .eq("item_id", itemId);

  const contas = await pluggy<{ results: Conta[] }>(key, `/accounts?itemId=${encodeURIComponent(itemId)}`);
  const de = new Date(Date.now() - JANELA_DIAS * 86400000).toISOString().slice(0, 10);
  let total = 0;

  for (const conta of contas.results ?? []) {
    let depois: string | null = null;
    for (let pagina = 0; pagina < 20; pagina++) {
      const qs = new URLSearchParams({ accountId: conta.id, dateFrom: de });
      if (depois) qs.set("after", depois);
      const r: { results: Transacao[]; next: string | null } = await pluggy(key, `/v2/transactions?${qs.toString()}`);
      const linhas = (r.results ?? []).map((t) => ({
        user_id: meu.user_id,
        item_id: itemId,
        transaction_id: t.id,
        account_id: conta.id,
        data: t.date,
        descricao: t.description,
        valor: t.amount,
        tipo: t.type,
        status: t.status ?? null,
        categoria_pluggy: t.category ?? null,
        atualizado_em: new Date().toISOString(),
      }));
      if (linhas.length) {
        const { error } = await (supabaseAdmin as any)
          .from("pluggy_transacoes")
          .upsert(linhas, { onConflict: "transaction_id" });
        if (error) throw new Error("Falha ao gravar os lançamentos.");
        total += linhas.length;
      }
      if (!r.next) break;
      const m = /after=([^&]+)/.exec(r.next);
      depois = m ? decodeURIComponent(m[1]!) : null;
      if (!depois) break;
    }
  }
  return { ignorado: false, transacoes: total };
}
