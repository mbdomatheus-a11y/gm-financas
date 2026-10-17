/**
 * Cliente da API da Pluggy e sincronização de um item, só no servidor.
 * As credenciais vêm de PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET e nunca vão ao navegador.
 * Nenhuma senha bancária passa por aqui: a conexão é feita no widget da Pluggy.
 *
 * Regras:
 *  - primeira importação de cada conexão: todo o histórico disponível, e tudo entra congelado;
 *  - importações seguintes: últimos 365 dias; lançamento novo congela 30 dias depois;
 *  - saída (DEBIT) vira despesa aprovada, origem "pluggy"; pagamento de fatura e transferência
 *    entre contas próprias não entram;
 *  - lançamento manual igual (mesmo cartão, data e valor) é substituído pelo da API;
 *  - lançamento rejeitado pelo usuário nunca volta;
 *  - investimentos, empréstimos e dados da conta são guardados como vieram da Pluggy.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://api.pluggy.ai";
const DIAS_HISTORICO_INICIAL = 3650;
const DIAS_JANELA_NORMAL = 365;
const ORIGENS_MANUAIS = ["manual", "fatura_rapida", "fatura_total_manual"];
/** Categorias do Pluggy que não são despesa: pagamento de fatura e transferência entre contas próprias. */
const CATEGORIAS_NAO_DESPESA = new Set(["credit card payment", "transfer - internal", "same person transfer"]);
/** Pagamento de fatura vindo da conta corrente quando a categoria não vem preenchida. */
const PAGAMENTO_FATURA = /pagament[oa].{0,20}fatura|pgto.{0,10}fatura|pagto.{0,10}cart/i;

type Conta = {
  id: string;
  type?: string;
  subtype?: string;
  name?: string;
  number?: string;
  owner?: string;
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
type Investimento = {
  id: string;
  name?: string;
  type?: string;
  issuer?: string;
  balance?: number;
  amount?: number;
  amountOriginal?: number;
  annualRate?: number;
  dueDate?: string;
};
type Emprestimo = {
  id: string;
  type?: string;
  creditorName?: string;
  amount?: number;
  balanceOutstandingAmount?: number;
  annualEffectiveCostRate?: number;
  dueDate?: string;
  [chave: string]: unknown;
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

const data10 = (v?: string | null) => (v ? v.slice(0, 10) : null);

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
  p: { userId: string; t: Transacao; cartaoId: string | null; cartaoFinal: string | null; banco: string | null; congelada: boolean },
) {
  const valor = Math.abs(p.t.amount);
  const agora = new Date().toISOString();
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
      await db
        .from("despesas")
        .update({ origem: "pluggy", pluggy_transaction_id: p.t.id, importada_em: agora, congelada: p.congelada })
        .eq("id", manual.id);
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
      importada_em: agora,
      congelada: p.congelada,
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

/** Investimentos da conexão: guarda o retorno da Pluggy (saldo, aplicado, taxa, vencimento). */
async function sincronizarInvestimentos(db: any, key: string, itemId: string, userId: string) {
  let r: { results?: Investimento[] };
  try {
    r = await pluggy(key, `/investments?itemId=${encodeURIComponent(itemId)}`);
  } catch {
    return; // conexão sem investimentos ou sem permissão: não derruba a sincronização
  }
  for (const i of r.results ?? []) {
    await db.from("pluggy_investimentos").upsert(
      {
        id: i.id,
        user_id: userId,
        item_id: itemId,
        nome: i.name ?? null,
        tipo: i.type ?? null,
        instituicao: i.issuer ?? null,
        saldo: i.balance ?? null,
        valor_aplicado: i.amountOriginal ?? i.amount ?? null,
        rentabilidade_anual: i.annualRate ?? null,
        vencimento: data10(i.dueDate),
        dados: i,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }
}

/** Empréstimos e financiamentos: saldo devedor, taxa e indexador, como a Pluggy informar. */
async function sincronizarEmprestimos(db: any, key: string, itemId: string, userId: string) {
  let r: { results?: Emprestimo[] };
  try {
    r = await pluggy(key, `/loans?itemId=${encodeURIComponent(itemId)}`);
  } catch {
    return;
  }
  for (const e of r.results ?? []) {
    const indice = (e as any).index ?? (e as any).indexer ?? null;
    await db.from("pluggy_emprestimos").upsert(
      {
        id: e.id,
        user_id: userId,
        item_id: itemId,
        tipo: e.type ?? null,
        instituicao: e.creditorName ?? null,
        valor_contratado: e.amount ?? null,
        saldo_devedor: e.balanceOutstandingAmount ?? null,
        taxa_anual: e.annualEffectiveCostRate ?? null,
        indexador: typeof indice === "string" ? indice : null,
        vencimento: data10(e.dueDate),
        dados: e,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }
}

/**
 * Atualiza um item: status, contas (com dados da conta), lançamentos, investimentos e empréstimos.
 * Na primeira importação, lê todo o histórico e congela tudo. Idempotente: upsert pelos IDs da Pluggy.
 * Só processa itens que já estão em pluggy_items (qualquer outro ID é ignorado).
 */
export async function sincronizarItem(itemId: string): Promise<{ ignorado: boolean; transacoes: number; primeira: boolean }> {
  const db = supabaseAdmin as any;
  const { data: meu, error: erroItem } = await db
    .from("pluggy_items")
    .select("user_id, conector, sincronizado_em")
    .eq("item_id", itemId)
    .maybeSingle();
  if (erroItem) throw new Error("Falha ao consultar a conexão.");
  if (!meu) return { ignorado: true, transacoes: 0, primeira: false };

  const primeira = !meu.sincronizado_em;
  const dias = primeira ? DIAS_HISTORICO_INICIAL : DIAS_JANELA_NORMAL;
  const { data: perfil } = await db.from("profiles").select("grupo_id").eq("id", meu.user_id).maybeSingle();
  const grupoId: string | null = perfil?.grupo_id ?? null;

  const key = await chaveApi();
  const item = await pluggy<{ status?: string }>(key, `/items/${itemId}`);
  await db
    .from("pluggy_items")
    .update({ status: item.status ?? null, atualizado_em: new Date().toISOString() })
    .eq("item_id", itemId);

  const contas = await pluggy<{ results: Conta[] }>(key, `/accounts?itemId=${encodeURIComponent(itemId)}`);
  const de = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
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
        numero_conta: conta.number ?? null,
        titular: conta.owner ?? null,
        dados: conta,
        limite: conta.creditData?.creditLimit ?? null,
        limite_disponivel: conta.creditData?.availableCreditLimit ?? null,
        fatura_valor: conta.type === "CREDIT" ? (conta.balance ?? null) : null,
        fatura_vencimento: data10(conta.creditData?.balanceDueDate),
        saldo: conta.type !== "CREDIT" ? (conta.balance ?? null) : null,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
    if (erroConta) throw new Error("Falha ao guardar a conta.");

    let depois: string | null = null;
    for (let pagina = 0; pagina < 200; pagina++) {
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
        if (CATEGORIAS_NAO_DESPESA.has((t.category ?? "").trim().toLowerCase())) continue;
        if (conta.type === "BANK" && PAGAMENTO_FATURA.test(t.description ?? "")) continue;
        await importarDespesa(db, { userId: meu.user_id, t, cartaoId, cartaoFinal, banco, congelada: primeira });
      }
      if (!r.next) break;
      const m = /after=([^&]+)/.exec(r.next);
      depois = m ? decodeURIComponent(m[1]!) : null;
      if (!depois) break;
    }
  }

  await sincronizarInvestimentos(db, key, itemId, meu.user_id);
  await sincronizarEmprestimos(db, key, itemId, meu.user_id);
  await db.from("pluggy_items").update({ sincronizado_em: new Date().toISOString() }).eq("item_id", itemId);
  return { ignorado: false, transacoes: total, primeira };
}
