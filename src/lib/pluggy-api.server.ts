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
const CATEGORIAS_NAO_DESPESA = new Set([
  "credit card payment",
  "transfer - internal",
  "same person transfer",
  "investments",
]);
/** Aplicação e resgate em investimento: movimenta o patrimônio, não é gasto. */
const DESCRICAO_NAO_DESPESA = /valor transferido para investimentos|aplica[cç][aã]o|resgate/i;
/** Parcela na descrição, ex.: "VETNASA 4/6", "DIAUTO 01/04", "AMAZONMKTPLC*AMGGR01/03". */
const PADRAO_PARCELA = /(?:^|[^0-9])(\d{1,2})\/(\d{1,2})(?![0-9])/;
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

/** Número da parcela e total, se a descrição trouxer "n/t" (ex.: 4/6). Ignora datas de período de fatura. */
function parcelaDe(descricao: string): { n: number; t: number } | null {
  if (/PERIODO/i.test(descricao)) return null;
  const m = PADRAO_PARCELA.exec(descricao);
  if (!m) return null;
  const n = Number(m[1]);
  const t = Number(m[2]);
  if (t < 2 || t > 60 || n < 1 || n > t) return null;
  return { n, t };
}

const isoData = (d: Date) => d.toISOString().slice(0, 10);
/** A Pluggy envia datas com hora ("2026-09-26T00:00:00.000Z"); aqui fica só AAAA-MM-DD. */
function dataIso(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  if (!m) throw new Error(`Data inválida na transação: ${String(v)}`);
  return `${m[1]}-${m[2]}-${m[3]}`;
}
function somarMeses(iso: string, meses: number): string {
  const [ano = 1970, mes = 1, dia = 1] = dataIso(iso).split("-").map(Number);
  // Dia 31 em mês de 30 dias vira o último dia do mês (e não cai no mês seguinte).
  const ultimoDia = new Date(Date.UTC(ano, mes - 1 + meses + 1, 0)).getUTCDate();
  return isoData(new Date(Date.UTC(ano, mes - 1 + meses, Math.min(dia, ultimoDia), 12)));
}

/**
 * Compra parcelada: cria a despesa com o total e projeta todas as parcelas até o fim.
 * As parcelas já cobradas (até n) ficam pagas; as seguintes ficam em aberto.
 * O grupo impede repetir o parcelamento quando as próximas parcelas aparecem no extrato.
 */
async function importarParcelado(
  db: any,
  p: { userId: string; grupoId: string | null; t: Transacao; cartaoId: string | null; cartaoFinal: string | null; banco: string | null; congelada: boolean },
  { n, t }: { n: number; t: number },
): Promise<boolean> {
  const valorParcela = Math.abs(p.t.amount);
  const nucleo = (p.t.description ?? "").replace(PADRAO_PARCELA, " ").replace(/\s+/g, " ").trim().toUpperCase();
  const primeira = somarMeses(p.t.date, -(n - 1));
  const grupo = `${p.cartaoFinal ?? p.banco ?? "x"}|${nucleo}|${t}|${valorParcela.toFixed(2)}|${primeira}`;

  const { data: jaGrupo } = await db.from("despesas").select("id").eq("pluggy_grupo", grupo).maybeSingle();
  if (jaGrupo) return false;

  if (p.cartaoId) {
    const { data: manual } = await db
      .from("despesas")
      .select("id")
      .eq("cartao_id", p.cartaoId)
      .in("origem", ORIGENS_MANUAIS)
      .is("pluggy_grupo", null)
      .eq("total_parcelas", t)
      .gte("data_primeira_parcela", somarMeses(primeira, 0).replace(/-(\d{2})$/, "-01"))
      .lte("data_primeira_parcela", somarMeses(primeira, 0).replace(/-(\d{2})$/, "-31"))
      .gte("valor_total", valorParcela * t - 1)
      .lte("valor_total", valorParcela * t + 1)
      .limit(1)
      .maybeSingle();
    if (manual) {
      await db
        .from("despesas")
        .update({ origem: "pluggy", pluggy_transaction_id: p.t.id, pluggy_grupo: grupo, importada_em: new Date().toISOString(), congelada: p.congelada })
        .eq("id", manual.id);
      await db.from("pluggy_transacoes").update({ substituiu_manual: true }).eq("transaction_id", p.t.id);
      return true;
    }
  }

  const { data: nova, error } = await db
    .from("despesas")
    .insert({
      descricao: nucleo || p.t.description,
      valor_total: valorParcela * t,
      moeda: "BRL",
      categoria: "Categoria a confirmar",
      tipo: "variavel",
      data_compra: primeira,
      total_parcelas: t,
      data_primeira_parcela: primeira,
      cartao_id: p.cartaoId,
      cartao_final: p.cartaoFinal,
      banco_nome: p.banco,
      origem: "pluggy",
      pluggy_transaction_id: p.t.id,
      pluggy_grupo: grupo,
      importada_em: new Date().toISOString(),
      congelada: p.congelada,
      created_by: p.userId,
      grupo_id: p.grupoId,
    })
    .select("id")
    .single();
  if (error) throw new Error("Falha ao criar a compra parcelada importada.");
  const parcelas = Array.from({ length: t }, (_, i) => ({
    despesa_id: nova.id,
    numero: i + 1,
    total: t,
    valor: valorParcela,
    moeda: "BRL",
    vencimento: somarMeses(primeira, i),
    paga: i + 1 <= n,
    grupo_id: p.grupoId,
  }));
  const { error: e2 } = await db.from("parcelas").insert(parcelas);
  if (e2) throw new Error("Falha ao criar as parcelas da compra importada.");
  return true;
}

/**
 * Cria a despesa importada, ou troca o lançamento manual igual por ela.
 * Pula lançamentos já importados e os rejeitados pelo usuário.
 */
async function importarDespesa(
  db: any,
  p: { userId: string; grupoId: string | null; t: Transacao; cartaoId: string | null; cartaoFinal: string | null; banco: string | null; congelada: boolean },
): Promise<boolean> {
  p = { ...p, t: { ...p.t, date: dataIso(p.t.date) } };
  const valor = Math.abs(p.t.amount);
  const agora = new Date().toISOString();
  const { data: rej } = await db.from("pluggy_transacoes").select("rejeitada").eq("transaction_id", p.t.id).maybeSingle();
  if (rej?.rejeitada) return false;
  const { data: ja } = await db.from("despesas").select("id").eq("pluggy_transaction_id", p.t.id).maybeSingle();
  if (ja) return false;

  const parc = parcelaDe(p.t.description ?? "");
  if (parc) return importarParcelado(db, p, parc);

  // Mesmo cartão (ou mesma conta) com lançamento manual:
  //  * mesma data e mesmo valor (centavos) -> o manual é substituído pelo Open Finance;
  //  * só o mesmo valor (centavos), outra data -> importa, mas marca como possível duplicidade.
  const base = () => {
    let q = db.from("despesas").select("id").in("origem", ORIGENS_MANUAIS).is("pluggy_transaction_id", null);
    q = p.cartaoId ? q.eq("cartao_id", p.cartaoId) : q.is("cartao_id", null);
    if (!p.cartaoId && p.banco) q = q.eq("banco_nome", p.banco);
    return q;
  };
  const { data: manual } = await base().eq("data_compra", p.t.date).eq("valor_total", valor).limit(1).maybeSingle();
  if (manual) {
    await db
      .from("despesas")
      .update({ origem: "pluggy", pluggy_transaction_id: p.t.id, importada_em: agora, congelada: p.congelada })
      .eq("id", manual.id);
    await db.from("pluggy_transacoes").update({ substituiu_manual: true }).eq("transaction_id", p.t.id);
    return true;
  }
  const { data: mesmoValor } = await base().eq("valor_total", valor).limit(1).maybeSingle();

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
      possivel_duplicidade: !!mesmoValor,
      created_by: p.userId,
      grupo_id: p.grupoId,
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
    grupo_id: p.grupoId,
  });
  if (e2) throw new Error("Falha ao criar a parcela da despesa importada.");
  return true;
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
export async function sincronizarItem(itemId: string): Promise<{ ignorado: boolean; transacoes: number; primeira: boolean; criadas: number }> {
  const db = supabaseAdmin as any;
  const { data: meu, error: erroItem } = await db
    .from("pluggy_items")
    .select("user_id, conector, sincronizado_em")
    .eq("item_id", itemId)
    .maybeSingle();
  if (erroItem) throw new Error("Falha ao consultar a conexão.");
  if (!meu) return { ignorado: true, transacoes: 0, primeira: false, criadas: 0 };

  const primeira = !meu.sincronizado_em;
  const { data: log } = await db
    .from("pluggy_sincronizacoes")
    .insert({ user_id: meu.user_id, item_id: itemId, primeira })
    .select("id")
    .single();
  try {
    const r = await executarSincronizacao(db, itemId, meu, primeira);
    await db
      .from("pluggy_sincronizacoes")
      .update({ status: "ok", terminado_em: new Date().toISOString(), transacoes_lidas: r.transacoes, despesas_criadas: r.criadas })
      .eq("id", log?.id);
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "Erro desconhecido";
    await db
      .from("pluggy_sincronizacoes")
      .update({ status: "erro", terminado_em: new Date().toISOString(), mensagem: msg })
      .eq("id", log?.id);
    throw e;
  }
}

/**
 * Entrada (crédito em conta bancária) vira receita já aprovada.
 * Pula as já importadas e as rejeitadas pelo usuário.
 */
async function importarReceita(
  db: any,
  p: { userId: string; grupoId: string | null; t: Transacao; congelada: boolean },
): Promise<boolean> {
  const { data: rej } = await db.from("pluggy_transacoes").select("rejeitada").eq("transaction_id", p.t.id).maybeSingle();
  if (rej?.rejeitada) return false;
  const { data: ja } = await db.from("receitas").select("id").eq("pluggy_transaction_id", p.t.id).maybeSingle();
  if (ja) return false;
  const valor = Math.abs(p.t.amount);
  const data = dataIso(p.t.date);
  const agora = new Date().toISOString();
  // Receita manual de mesmo valor: mesma data substitui; outra data importa marcada como possível duplicidade.
  const base = () =>
    db.from("receitas").select("id").neq("origem", "pluggy").is("pluggy_transaction_id", null).eq("created_by", p.userId).eq("valor", valor);
  const { data: mesmoDia } = await base().eq("data_recebimento", data).limit(1).maybeSingle();
  if (mesmoDia) {
    await db
      .from("receitas")
      .update({ origem: "pluggy", pluggy_transaction_id: p.t.id, importada_em: agora, congelada: p.congelada })
      .eq("id", mesmoDia.id);
    await db.from("pluggy_transacoes").update({ substituiu_manual: true }).eq("transaction_id", p.t.id);
    return true;
  }
  const { data: mesmoValor } = await base().limit(1).maybeSingle();
  const { error } = await db.from("receitas").insert({
    descricao: p.t.description || "Entrada",
    valor,
    moeda: "BRL",
    categoria: "Outras receitas",
    data_recebimento: data,
    recorrente: false,
    responsavel: null,
    origem: "pluggy",
    pluggy_transaction_id: p.t.id,
    importada_em: agora,
    congelada: p.congelada,
    possivel_duplicidade: !!mesmoValor,
    created_by: p.userId,
    grupo_id: p.grupoId,
  });
  if (error) throw new Error("Falha ao criar a receita importada.");
  return true;
}

async function executarSincronizacao(
  db: any,
  itemId: string,
  meu: { user_id: string; conector: string | null },
  primeira: boolean,
): Promise<{ ignorado: boolean; transacoes: number; primeira: boolean; criadas: number }> {
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
  let criadas = 0;

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
        if (t.status === "PENDING") continue;
        if (t.type === "CREDIT" && conta.type === "BANK") {
          if (CATEGORIAS_NAO_DESPESA.has((t.category ?? "").trim().toLowerCase())) continue;
          if (DESCRICAO_NAO_DESPESA.test(t.description ?? "")) continue;
          await importarReceita(db, { userId: meu.user_id, grupoId, t, congelada: primeira });
          continue;
        }
        if (t.type !== "DEBIT") continue;
        if (CATEGORIAS_NAO_DESPESA.has((t.category ?? "").trim().toLowerCase())) continue;
        if (DESCRICAO_NAO_DESPESA.test(t.description ?? "")) continue;
        if (conta.type === "BANK" && PAGAMENTO_FATURA.test(t.description ?? "")) continue;
        if (await importarDespesa(db, { userId: meu.user_id, grupoId, t, cartaoId, cartaoFinal, banco, congelada: primeira })) criadas++;
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
  return { ignorado: false, transacoes: total, primeira, criadas };
}
