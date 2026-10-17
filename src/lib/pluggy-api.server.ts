/**
 * Cliente da API da Pluggy e sincronização de um item, só no servidor.
 * As credenciais vêm de PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET e nunca vão ao navegador.
 * Nenhuma senha bancária passa por aqui: a conexão é feita no widget da Pluggy.
 *
 * Regras da importação automática:
 *  - lançamento de saída (DEBIT) vira despesa já aprovada, origem "pluggy";
 *  - se já existe lançamento manual igual (mesmo cartão, data e valor), o da API substitui o manual;
 *  - lançamento rejeitado pelo usuário nunca volta;
 *  - conta conectada bloqueia lançamento manual no mesmo cartão (trava no banco de dados).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://api.pluggy.ai";
const JANELA_DIAS = 365;
const ORIGENS_MANUAIS = ["manual", "fatura_rapida", "fatura_total_manual"];
/** Pagamento de fatura vindo da conta corrente: já aparece nas compras do cartão, não pode duplicar. */
const PAGAMENTO_FATURA = /pagament[oa].{0,20}fatura|pgto.{0,10}fatura|pagto.{0,10}cart/i;

type Conta = {
  id: string;
  type?: string;
  subtype?: string;
  name?: string;
  number?: string;
  balance?: number;
  currencyCode?: string;
  creditData?: { creditLimit?: number; availableCreditLimit?: number; balanceDueDate?: string; minimumPayment?: number };
};
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

function ultimos4(numero?: string): string | null {
  const d = (numero ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : null;
}

/** Acha o cartão cadastrado no Control ALL pelos 4 últimos dígitos, dentro do mesmo grupo. */
async function cartaoPeloFinal(db: any, final: string, grupoId: string | null): Promise<string | null> {
  let q = db.from("cartoes").select("id").eq("final", final);
  q = grupoId ? q.eq("grupo_id", grupoId) : q.is("grupo_id", null);
  const { data } = await q.limit(1).maybeSingle();
  return data?.id ?? null;
}

/**
 * Cria a despesa importada, ou troca o lançamento manual igual por ela.
 * Pula lançamentos já importados e os rejeitados pelo usuário.
 */
async function importarDespesa(
  db: any,
  p: { userId: string; t: Transacao; cartaoId: string | null; cartaoFinal: string | null; banco: string | null },
) {
  const valor = Math.abs(p.t.amount);
  const { data: rej } = await db.from("pluggy_transacoes").select("rejeitada").eq("transaction_id", p.t.id).maybeSingle();
  if (rej?.rejeitada) return;
  const { data: ja } = await db.from("despesas").select("id").eq("pluggy_transaction_id", p.t.id).maybeSingle();
  if (ja) return;

  if (p.cartaoId) {
    const { data: manual } = await db
      .from("despesas")
      .select("id")
      .eq("cartao_id", p.cartaoId)
      .in("origem", ORIGENS_MANUAIS)
      .is("pluggy_transaction_id", null)
      .eq("data_compra", p.t.date)
      .eq("valor_total", valor)
      .limit(1)
      .maybeSingle();
    if (manual) {
      await db.from("despesas").update({ origem: "pluggy", pluggy_transaction_id: p.t.id, importada_em: new Date().toISOString() }).eq("id", manual.id);
      await db.from("pluggy_transacoes").update({ substituiu_manual: true }).eq("transaction_id", p.t.id);
      return;
    }
  }

  const { data: nova, error } = await db
    .from("despesas")
    .insert({
      descricao: p.t.description,
      valor_total: valor,
      moeda: "BRL",
      categoria: "Categoria a confirmar",
      tipo: "variavel",
      data_compra: p.t.date,
      total_parcelas: 1,
      data_primeira_parcela: p.t.date,
      cartao_id: p.cartaoId,
      cartao_final: p.cartaoFinal,
      banco_nome: p.banco,
      origem: "pluggy",
      pluggy_transaction_id: p.t.id,
      importada_em: new Date().toISOString(),
      created_by: p.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error("Falha ao criar a despesa importada.");
  const { error: e2 } = await db.from("parcelas").insert({
    despesa_id: nova.id,
    numero: 1,
    total: 1,
    valor,
    moeda: "BRL",
    vencimento: p.t.date,
    paga: false,
  });
  if (e2) throw new Error("Falha ao criar a parcela da despesa importada.");
}

/**
 * Atualiza um item: status, contas, lançamentos dos últimos 90 dias e as despesas correspondentes.
 * Idempotente: grava com upsert pelo ID da transação da Pluggy, então rodar de novo não duplica.
 * Só processa itens que já estão em pluggy_items (qualquer outro ID é ignorado).
 */
export async function sincronizarItem(itemId: string): Promise<{ ignorado: boolean; transacoes: number }> {
  const db = supabaseAdmin as any;
  const { data: meu, error: erroItem } = await db
    .from("pluggy_items")
    .select("user_id, conector")
    .eq("item_id", itemId)
    .maybeSingle();
  if (erroItem) throw new Error("Falha ao consultar a conexão.");
  if (!meu) return { ignorado: true, transacoes: 0 };

  const { data: perfil } = await db.from("profiles").select("grupo_id").eq("id", meu.user_id).maybeSingle();
  const grupoId: string | null = perfil?.grupo_id ?? null;

  const key = await chaveApi();
  const item = await pluggy<{ status?: string }>(key, `/items/${itemId}`);
  await db
    .from("pluggy_items")
    .update({ status: item.status ?? null, atualizado_em: new Date().toISOString() })
    .eq("item_id", itemId);

  const contas = await pluggy<{ results: Conta[] }>(key, `/accounts?itemId=${encodeURIComponent(itemId)}`);
  const de = new Date(Date.now() - JANELA_DIAS * 86400000).toISOString().slice(0, 10);
  let total = 0;

  for (const conta of contas.results ?? []) {
    const cartaoFinal = conta.type === "CREDIT" ? ultimos4(conta.number) : null;
    const cartaoId = cartaoFinal ? await cartaoPeloFinal(db, cartaoFinal, grupoId) : null;
    const banco = meu.conector ?? conta.name ?? null;

    const { error: erroConta } = await db.from("pluggy_contas").upsert(
      {
        user_id: meu.user_id,
        grupo_id: grupoId,
        item_id: itemId,
        account_id: conta.id,
        tipo: conta.type ?? "BANK",
        nome: conta.name ?? null,
        cartao_final: cartaoFinal,
        limite: conta.creditData?.creditLimit ?? null,
        limite_disponivel: conta.creditData?.availableCreditLimit ?? null,
        fatura_valor: conta.type === "CREDIT" ? (conta.balance ?? null) : null,
        fatura_vencimento: conta.creditData?.balanceDueDate ? conta.creditData.balanceDueDate.slice(0, 10) : null,
        saldo: conta.type !== "CREDIT" ? (conta.balance ?? null) : null,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
    if (erroConta) throw new Error("Falha ao guardar a conta.");

    let depois: string | null = null;
    for (let pagina = 0; pagina < 20; pagina++) {
      const qs = new URLSearchParams({ accountId: conta.id, dateFrom: de });
      if (depois) qs.set("after", depois);
      const r: { results: Transacao[]; next: string | null } = await pluggy(key, `/v2/transactions?${qs.toString()}`);
      const lista = r.results ?? [];
      const agora = new Date().toISOString();
      const linhas = lista.map((t) => ({
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
        atualizado_em: agora,
      }));
      if (linhas.length) {
        const { error } = await db.from("pluggy_transacoes").upsert(linhas, { onConflict: "transaction_id" });
        if (error) throw new Error("Falha ao gravar os lançamentos.");
        total += linhas.length;
      }
      for (const t of lista) {
        if (t.type !== "DEBIT" || t.status === "PENDING") continue;
        if (conta.type === "BANK" && PAGAMENTO_FATURA.test(t.description ?? "")) continue;
        await importarDespesa(db, { userId: meu.user_id, t, cartaoId, cartaoFinal, banco });
      }
      if (!r.next) break;
      const m = /after=([^&]+)/.exec(r.next);
      depois = m ? decodeURIComponent(m[1]!) : null;
      if (!depois) break;
    }
  }
  return { ignorado: false, transacoes: total };
}
