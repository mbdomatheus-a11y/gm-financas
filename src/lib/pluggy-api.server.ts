/**
 * Cliente da API da Pluggy e sincronização de um item, só no servidor.
 * As credenciais vêm de PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET e nunca vão ao navegador.
 * Nenhuma senha bancária passa por aqui: a conexão é feita no widget da Pluggy.
 *
 * Regras:
 *  - primeira importação de cada conexão: todo o histórico disponível, e tudo entra congelado;
 *  - importações seguintes: últimos 365 dias; lançamento novo congela 30 dias depois;
 *  - saída (DEBIT) de CARTÃO vira despesa aprovada, origem "pluggy"; pagamento de fatura e transferência
 *    entre contas próprias não entram;
 *  - conta corrente (PIX, débitos, créditos e saldo) só é guardada em pluggy_transacoes, sem virar
 *    despesa ou receita, até o Control ALL funcionar como conta corrente;
 *  - lançamento manual igual (mesmo cartão, data e valor) é substituído pelo da API;
 *  - lançamento rejeitado pelo usuário nunca volta;
 *  - investimentos, empréstimos e dados da conta são guardados como vieram da Pluggy.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { excluirReceitaSerie } from "@/lib/exclusao-recorrente";
import { vencimentoDaFatura } from "@/lib/fatura-ciclo";

const BASE = "https://api.pluggy.ai";
const DIAS_HISTORICO_INICIAL = 3650;
const DIAS_JANELA_NORMAL = 365;
const TRAVA_MINUTOS = 10;
/** Palavras que não identificam o beneficiário do boleto. */
const PALAVRAS_BOLETO_GENERICAS = new Set([
  "PAGAMENTO", "BOLETO", "PAGTO", "LTDA", "EIRELI", "CIA", "SERVICOS", "BRASIL", "PAGAMENTOS", "INSTITUICAO", "DOS", "DAS",
]);
/** Lançamento que não veio do Open Finance (manual, importado de arquivo etc.): pode ser substituído por ele. */
const FILTRO_NAO_PLUGGY = "origem.is.null,origem.neq.pluggy";
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

type Conta = {
  id: string;
  type?: string;
  subtype?: string;
  name?: string;
  marketingName?: string;
  number?: string;
  owner?: string;
  balance?: number;
  currencyCode?: string;
  creditData?: { brand?: string; creditLimit?: number; availableCreditLimit?: number; balanceDueDate?: string; minimumPayment?: number; additionalCards?: { number?: string }[] };
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
  /** Dados do cartão que o próprio banco manda (25/10/2026): parcela, total e a fatura (billId). */
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    totalAmount?: number | null;
    purchaseDate?: string | null;
    billId?: string | null;
  } | null;
};

/**
 * Faturas do cartão como o banco informa (id → vencimento AAAA-MM-DD). Cada compra traz o billId da
 * fatura em que entrou; assim a despesa cai no mês da fatura certa, igual ao app do banco, em vez
 * de o Control ALL adivinhar pelo dia de fechamento ou pela data da compra.
 */
/** Diagnóstico da última sincronização (fica na mensagem do histórico). */
const DIAG = { faturas: 0, comFatura: 0, semFatura: 0 };

async function faturasDoCartao(key: string, accountId: string): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  try {
    const r: any = await pluggy(key, `/bills?accountId=${encodeURIComponent(accountId)}&pageSize=100`);
    for (const b of r?.results ?? []) {
      const venc = String(b?.dueDate ?? "").slice(0, 10);
      if (b?.id && /^\d{4}-\d{2}-\d{2}$/.test(venc)) mapa.set(String(b.id), venc);
    }
  } catch {
    // banco sem faturas na Pluggy: segue a regra antiga
  }
  DIAG.faturas += mapa.size;
  return mapa;
}
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
  if (r.status === 404) {
    throw new Error("A Pluggy não reconhece esta conexão com a chave do site (404). O Item ID precisa ser de uma conexão criada na aplicação do site, no dashboard.pluggy.ai, com o conector MeuPluggy. Remova este card e cole o Item ID correto.");
  }
  if (!r.ok) throw new Error(`Falha ao consultar a Pluggy (${r.status}).`);
  return (await r.json()) as T;
}

function ultimos4(numero?: string): string | null {
  const d = (numero ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : null;
}

const data10 = (v?: string | null) => (v ? v.slice(0, 10) : null);

/** Nome sem acento e sem caixa, para comparar bancos e contas. */
function chaveNome(texto: string): string {
  return (texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Trechos do nome da conta do Open Finance que identificam um banco já conhecido. */
const BANCOS_CONHECIDOS: Array<[string, string]> = [
  ["nu pagamentos", "nubank"],
  ["nubank", "nubank"],
  ["itau", "itau"],
  ["santander", "santander"],
  ["bradesco", "bradesco"],
  ["banco inter", "inter"],
  ["mercado pago", "mercado pago"],
  ["picpay", "picpay"],
  ["caixa", "caixa"],
  ["banco do brasil", "banco do brasil"],
];

function bancoCanonico(nome: string): string {
  const n = chaveNome(nome);
  for (const [trecho, canonico] of BANCOS_CONHECIDOS) if (n.includes(trecho)) return canonico;
  return n;
}

/**
 * Acha o banco do grupo que corresponde ao nome da conta do Open Finance.
 * Com `criar`, cria o banco quando não existe (usado para conta corrente, não para cartão).
 */
async function garantirBanco(
  db: any,
  p: { grupoId: string | null; nome: string; criar: boolean; titular?: string | null; numero?: string | null },
): Promise<{ id: string; nome: string } | null> {
  const alvo = bancoCanonico(p.nome);
  if (!alvo) return null;
  let q = db.from("bancos").select("id, nome, conta");
  q = p.grupoId ? q.eq("grupo_id", p.grupoId) : q.is("grupo_id", null);
  const { data: lista } = await q;
  // Primeiro pelo número da conta: o usuário pode ter renomeado o banco no site ou no app
  // (ex.: "itau" para "Itaú Personnalité"), e o nome deixa de bater.
  const pelaConta = p.numero ? (lista ?? []).find((b: any) => b.conta && String(b.conta).trim() === String(p.numero).trim()) : null;
  if (pelaConta) return { id: pelaConta.id, nome: pelaConta.nome };
  const achado = (lista ?? []).find((b: any) => bancoCanonico(b.nome) === alvo);
  if (achado) return { id: achado.id, nome: achado.nome };
  if (!p.criar) return null;
  const { data: novo, error } = await db
    .from("bancos")
    .insert({
      nome: p.nome.trim().replace(/\s+/g, " "),
      titular: p.titular ?? null,
      conta: p.numero ?? null,
      tipo_conta: "corrente",
      saldo_atual: 0,
      grupo_id: p.grupoId,
    })
    .select("id, nome")
    .single();
  if (error) throw new Error("Falha ao criar o banco do Open Finance.");
  return { id: novo.id, nome: novo.nome };
}

/**
 * Acha o cartão pelos 4 últimos dígitos, no grupo. Se não existe, cria com os dados do Open Finance.
 * Atualiza limite e dia de vencimento; não mexe em apelido, fechamento nem banco já preenchidos.
 */
async function garantirCartao(
  db: any,
  p: { grupoId: string | null; final: string; nome: string; bandeira: string; limite: number | null; diaVencimento: number | null; titular: string; bancoId: string | null },
): Promise<{ id: string; bancoId: string | null }> {
  let q = db.from("cartoes").select("id, banco_id").eq("final", p.final);
  q = p.grupoId ? q.eq("grupo_id", p.grupoId) : q.is("grupo_id", null);
  const { data: existente } = await q.limit(1).maybeSingle();
  const cartaoId = await gravarCartao(db, p, existente);
  // Lançamentos antigos desse cartão, criados antes de ele existir, ficam sem cartão: liga agora.
  let ligar = db.from("despesas").update({ cartao_id: cartaoId }).is("cartao_id", null).eq("cartao_final", p.final);
  ligar = p.grupoId ? ligar.eq("grupo_id", p.grupoId) : ligar.is("grupo_id", null);
  const { error: erroLigar } = await ligar;
  if (erroLigar) throw new Error("Falha ao ligar os lançamentos ao cartão.");
  return { id: cartaoId, bancoId: existente?.banco_id ?? p.bancoId };
}

async function nomeDoBanco(db: any, bancoId: string): Promise<string | null> {
  const { data } = await db.from("bancos").select("nome").eq("id", bancoId).maybeSingle();
  return data?.nome ?? null;
}

async function gravarCartao(
  db: any,
  p: { grupoId: string | null; final: string; nome: string; bandeira: string; limite: number | null; diaVencimento: number | null; titular: string; bancoId: string | null },
  existente: { id: string; banco_id: string | null } | null,
): Promise<string> {
  if (existente) {
    const atualiza: { limite?: number; dia_vencimento?: number; banco_id?: string } = {};
    if (p.limite != null) atualiza.limite = p.limite;
    if (p.diaVencimento) atualiza.dia_vencimento = p.diaVencimento;
    if (!existente.banco_id && p.bancoId) atualiza.banco_id = p.bancoId;
    if (Object.keys(atualiza).length) {
      const { error } = await db.from("cartoes").update(atualiza).eq("id", existente.id);
      if (error) throw new Error("Falha ao atualizar o cartão do Open Finance.");
    }
    return existente.id;
  }
  const { data: novo, error } = await db
    .from("cartoes")
    .insert({
      titular: p.titular,
      final: p.final,
      apelido: p.nome,
      bandeira: p.bandeira,
      tipo: "credito",
      limite: p.limite,
      dia_vencimento: p.diaVencimento,
      banco_id: p.bancoId,
      grupo_id: p.grupoId,
    })
    .select("id")
    .single();
  if (error) throw new Error("Falha ao criar o cartão do Open Finance.");
  return novo.id;
}

/** Bandeira no formato do app (ex.: MASTERCARD vira Mastercard). */
function marcaCartao(brand?: string | null): string {
  const b = (brand ?? "").trim();
  return b ? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase() : "Outra";
}

/** Dia do mês de uma data AAAA-MM-DD (vencimento da fatura). */
function diaDe(v?: string | null): number | null {
  const m = /^\d{4}-\d{2}-(\d{2})/.exec(v ?? "");
  return m ? Number(m[1]) : null;
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

/** Próximo vencimento do cartão em data igual ou depois da informada (dia de vencimento do cadastro). */
async function proximoVencimentoCartao(db: any, cartaoId: string | null, data: string): Promise<string | null> {
  if (!cartaoId) return null;
  const { data: cartao } = await db.from("cartoes").select("dia_vencimento").eq("id", cartaoId).maybeSingle();
  const dia = cartao?.dia_vencimento ? Number(cartao.dia_vencimento) : null;
  if (!dia) return null;
  const iso = dataIso(data);
  const [ano = 1970, mes = 1] = iso.split("-").map(Number);
  for (let k = 0; k <= 1; k++) {
    const ultimo = new Date(Date.UTC(ano, mes + k, 0)).getUTCDate();
    const cand = isoData(new Date(Date.UTC(ano, mes - 1 + k, Math.min(dia, ultimo), 12)));
    if (cand >= iso) return cand;
  }
  return null;
}

/** Parcelamento que já existe: as parcelas até a n-ésima (a que acabou de aparecer no extrato) ficam pagas. */
async function marcarPagasAte(db: any, despesaId: string, n: number): Promise<void> {
  try {
    await db.from("parcelas").update({ paga: true }).eq("despesa_id", despesaId).lte("numero", n).eq("paga", false);
  } catch {
    // compra congelada: mantém como está
  }
}

/**
 * Compra parcelada: cria a despesa com o total e projeta todas as parcelas até o fim.
 * As parcelas já cobradas (até n) ficam pagas; as seguintes ficam em aberto.
 * O grupo impede repetir o parcelamento quando as próximas parcelas aparecem no extrato.
 */
async function importarParcelado(
  db: any,
  p: { userId: string; grupoId: string | null; t: Transacao; cartaoId: string | null; cartaoFinal: string | null; banco: string | null; congelada: boolean; pendente?: boolean; faturas?: Map<string, string> },
  { n, t }: { n: number; t: number },
): Promise<boolean> {
  const valorParcela = Math.abs(p.t.amount);
  const nucleo = (p.t.description ?? "").replace(PADRAO_PARCELA, " ").replace(/\s+/g, " ").trim().toUpperCase();
  const meta = p.t.creditCardMetadata ?? null;
  // Data da compra e fatura desta parcela como o banco informa; sem isso, estima pela data da linha.
  const compraBanco = meta?.purchaseDate ? String(meta.purchaseDate).slice(0, 10) : null;
  const primeira = compraBanco && /^\d{4}-\d{2}-\d{2}$/.test(compraBanco) ? compraBanco : somarMeses(p.t.date, -(n - 1));
  // Fatura desta parcela: 1) billId do banco; 2) a linha do extrato vem datada no fechamento, então vale o
  // próximo vencimento do cartão depois dessa data; 3) sem nada disso, cai na data da compra (regra antiga).
  const vencDestaParcela =
    (meta?.billId ? p.faturas?.get(String(meta.billId)) ?? null : null) ?? (await proximoVencimentoCartao(db, p.cartaoId, p.t.date));
  // As parcelas podem cair em dias diferentes do mesmo mês (ex.: 03/09 e 11/09), então a compra
  // é identificada pelo mês da primeira parcela, e não pelo dia.
  const primeiraMes = primeira.slice(0, 7);
  const grupo = `${p.cartaoFinal ?? p.banco ?? "x"}|${nucleo}|${t}|${valorParcela.toFixed(2)}|${primeira}`;

  // 25/10/2026: o Nubank data as parcelas de um jeito que a 1ª calculada pode cair um mês antes
  // ou depois (ex.: WILCA 1/5 em 04/07 e 4/5 em 08/06), e o total pode variar alguns centavos
  // (ex.: 9x de R$ 106,72 e de R$ 106,66). A mesma compra é reconhecida com essa folga.
  let jaMes = db
    .from("despesas")
    .select("id")
    .eq("total_parcelas", t)
    .eq("descricao", nucleo || p.t.description)
    .gte("data_primeira_parcela", somarMeses(`${primeiraMes}-01`, -1))
    .lt("data_primeira_parcela", somarMeses(`${primeiraMes}-01`, 2))
    .gte("valor_total", (valorParcela - 0.3) * t)
    .lte("valor_total", (valorParcela + 0.3) * t)
    .limit(1);
  jaMes = p.cartaoFinal
    ? jaMes.eq("cartao_final", p.cartaoFinal)
    : p.banco
      ? jaMes.eq("banco_nome", p.banco)
      : jaMes.is("banco_nome", null);
  const { data: jaCompra } = await jaMes.maybeSingle();
  // Parcela pendente (fatura aberta ou futura) não marca nada como pago.
  if (jaCompra) {
    if (!p.pendente) await marcarPagasAte(db, jaCompra.id, n);
    return false;
  }
  const { data: jaGrupo } = await db.from("despesas").select("id").eq("pluggy_grupo", grupo).maybeSingle();
  if (jaGrupo) {
    if (!p.pendente) await marcarPagasAte(db, jaGrupo.id, n);
    return false;
  }

  if (p.cartaoId) {
    const { data: manual } = await db
      .from("despesas")
      .select("id")
      .eq("cartao_id", p.cartaoId)
      .or(FILTRO_NAO_PLUGGY)
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
      valor_total: meta?.totalAmount && Math.abs(Number(meta.totalAmount)) > 0 ? Math.abs(Number(meta.totalAmount)) : valorParcela * t,
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
    // Com a fatura desta parcela, as outras caem uma por mês a partir dela (igual à fatura do banco).
    vencimento: vencDestaParcela ? somarMeses(vencDestaParcela, i + 1 - n) : somarMeses(primeira, i),
    paga: p.pendente ? somarMeses(primeira, i) < new Date().toISOString().slice(0, 10) && i + 1 < n : i + 1 <= n,
    grupo_id: p.grupoId,
  }));
  const { error: e2 } = await db.from("parcelas").insert(parcelas);
  if (e2) throw new Error("Falha ao criar as parcelas da compra importada.");
  return true;
}

/** Vencimento da fatura à qual a compra do cartão pertence. Sem cartão cadastrado, usa a própria data. */
async function vencimentoCartao(db: any, cartaoId: string | null, data: string): Promise<string> {
  const iso = dataIso(data);
  if (!cartaoId) return iso;
  const { data: cartao } = await db.from("cartoes").select("dia_fechamento, dia_vencimento").eq("id", cartaoId).maybeSingle();
  if (!cartao?.dia_vencimento) return iso;
  return vencimentoDaFatura(iso, { diaFechamento: cartao.dia_fechamento ?? null, diaVencimento: cartao.dia_vencimento });
}

/**
 * Entre os manuais de mesmo valor, escolhe o que se parece com a transação do Open Finance:
 * data até 3 dias de distância, ou ao menos uma palavra em comum na descrição. Prefere a data mais próxima.
 */
function manualParecido(
  lista: { id: string; data_compra?: string | null; descricao?: string | null }[],
  dataTx: string,
  descricaoTx: string,
  diasTolerancia: number,
): { id: string } | null {
  const palavrasTx = palavrasDoNome(descricaoTx);
  let melhor: { id: string; dist: number } | null = null;
  for (const m of lista) {
    const dist = Math.abs(Date.parse(dataIso(m.data_compra ?? dataTx)) - Date.parse(dataIso(dataTx))) / 86400000;
    const descricaoBate = palavrasDoNome(m.descricao ?? "").some((a) => palavrasTx.some((b) => a.includes(b) || b.includes(a)));
    if (dist > diasTolerancia && !descricaoBate) continue;
    if (!melhor || dist < melhor.dist) melhor = { id: m.id, dist };
  }
  return melhor;
}

/**
 * Compra pendente (25/10/2026): a fatura aberta chega como "PENDING" e antes era ignorada, por isso
 * só apareciam as parcelas de compras antigas. Agora a pendente entra na fatura e, quando o banco
 * confirma com outro ID, a mesma despesa passa a apontar para a transação confirmada (sem duplicar).
 */
async function adotarPendente(
  db: any,
  p: { cartaoId: string | null; banco: string | null; valor: number; data: string; novoId: string },
): Promise<boolean> {
  const de = somarDias(p.data, -5);
  const ate = somarDias(p.data, 5);
  let q = db
    .from("despesas")
    .select("id, pluggy_transaction_id")
    .eq("origem", "pluggy")
    .eq("total_parcelas", 1)
    .eq("valor_total", p.valor)
    .gte("data_compra", de)
    .lte("data_compra", ate)
    .not("pluggy_transaction_id", "is", null);
  q = p.cartaoId ? q.eq("cartao_id", p.cartaoId) : p.banco ? q.eq("banco_nome", p.banco) : q;
  const { data: candidatas } = await q.limit(10);
  if (!candidatas?.length) return false;
  const { data: pendentes } = await db
    .from("pluggy_transacoes")
    .select("transaction_id")
    .in("transaction_id", candidatas.map((c: any) => c.pluggy_transaction_id))
    .eq("status", "PENDING");
  const ids = new Set((pendentes ?? []).map((x: any) => String(x.transaction_id)));
  const alvo = candidatas.find((c: any) => ids.has(String(c.pluggy_transaction_id)));
  if (!alvo) return false;
  await db.from("despesas").update({ pluggy_transaction_id: p.novoId, data_compra: p.data }).eq("id", alvo.id);
  // A pendente antiga deixa de existir no banco: some da tabela para não ser limpa depois.
  await db.from("pluggy_transacoes").delete().eq("transaction_id", alvo.pluggy_transaction_id);
  return true;
}

/**
 * Compras pendentes que o banco não devolveu nesta sincronização foram canceladas ou confirmadas
 * com outro ID (já adotado acima): a despesa da pendente sai, para a fatura não ficar com fantasma.
 */
async function limparPendentesSumidas(db: any, accountId: string, desde: string, inicioSync: string): Promise<void> {
  const { data: sumidas } = await db
    .from("pluggy_transacoes")
    .select("transaction_id")
    .eq("account_id", accountId)
    .eq("status", "PENDING")
    .gte("data", desde)
    .lt("atualizado_em", inicioSync);
  for (const s of sumidas ?? []) {
    const { data: d } = await db.from("despesas").select("id, total_parcelas").eq("pluggy_transaction_id", s.transaction_id).maybeSingle();
    if (d && Number(d.total_parcelas) === 1) {
      await db.from("parcelas").delete().eq("despesa_id", d.id);
      await db.from("despesas").delete().eq("id", d.id);
    }
    await db.from("pluggy_transacoes").delete().eq("transaction_id", s.transaction_id);
  }
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${dataIso(iso)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Cria a despesa importada, ou troca o lançamento manual igual por ela.
 * Pula lançamentos já importados e os rejeitados pelo usuário.
 */
async function importarDespesa(
  db: any,
  p: { userId: string; grupoId: string | null; t: Transacao; cartaoId: string | null; cartaoFinal: string | null; banco: string | null; congelada: boolean; diasTolerancia: number; pendente?: boolean; faturas?: Map<string, string> },
): Promise<boolean> {
  p = { ...p, t: { ...p.t, date: dataIso(p.t.date) } };
  const valor = Math.abs(p.t.amount);
  const agora = new Date().toISOString();
  const { data: rej } = await db.from("pluggy_transacoes").select("rejeitada").eq("transaction_id", p.t.id).maybeSingle();
  if (rej?.rejeitada) return false;
  const { data: ja } = await db.from("despesas").select("id").eq("pluggy_transaction_id", p.t.id).maybeSingle();
  if (ja) return false;

  const meta = p.t.creditCardMetadata ?? null;
  // Parcela informada pelo banco vale mais que a lida na descrição ("4/6").
  const parc =
    meta?.totalInstallments && Number(meta.totalInstallments) > 1 && meta.installmentNumber
      ? { n: Number(meta.installmentNumber), t: Number(meta.totalInstallments) }
      : parcelaDe(p.t.description ?? "");
  if (parc) return importarParcelado(db, p, parc);
  const vencFatura = meta?.billId ? p.faturas?.get(String(meta.billId)) ?? null : null;
  if (p.cartaoId) {
    if (vencFatura) DIAG.comFatura++;
    else DIAG.semFatura++;
  }

  // Confirmada pelo banco com outro ID: assume a despesa que entrou quando ainda estava pendente.
  if (!p.pendente && (await adotarPendente(db, { cartaoId: p.cartaoId, banco: p.banco, valor, data: p.t.date, novoId: p.t.id }))) {
    return true;
  }

  // Mesmo cartão (ou mesma conta) com lançamento manual:
  //  * manual de mesmo valor (centavos) e data até 3 dias, ou descrição parecida -> o Open Finance prevalece e substitui o manual;
  //  * manual de mesmo valor sem nada parecido -> importa, marcado como possível duplicidade.
  const base = () => {
    let q = db.from("despesas").select("id").or(FILTRO_NAO_PLUGGY).is("pluggy_transaction_id", null);
    q = p.cartaoId ? q.eq("cartao_id", p.cartaoId) : q.is("cartao_id", null);
    if (!p.cartaoId && p.banco) q = q.eq("banco_nome", p.banco);
    return q;
  };
  const { data: candidatos } = await base().eq("valor_total", valor).select("id, data_compra, descricao");
  const manual = manualParecido(candidatos ?? [], p.t.date, p.t.description ?? "", p.diasTolerancia);
  if (manual) {
    await db
      .from("despesas")
      .update({ origem: "pluggy", pluggy_transaction_id: p.t.id, importada_em: agora, congelada: p.congelada })
      .eq("id", manual.id);
    await db.from("pluggy_transacoes").update({ substituiu_manual: true }).eq("transaction_id", p.t.id);
    return true;
  }
  const mesmoValor = (candidatos ?? []).length > 0;

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
      possivel_duplicidade: mesmoValor,
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
    vencimento: vencFatura ?? (await vencimentoCartao(db, p.cartaoId, p.t.date)),
    paga: false,
    grupo_id: p.grupoId,
  });
  if (e2) throw new Error("Falha ao criar a parcela da despesa importada.");
  return true;
}

/** Palavras significativas (sem acento, 4+ letras) do nome do beneficiário ou da descrição. */
function palavrasDoNome(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length >= 4 && !PALAVRAS_BOLETO_GENERICAS.has(w));
}

/**
 * Pagamento de boleto da conta corrente: procura a despesa (sem cartão, parcela única) de mesmo valor,
 * com vencimento até 10 dias de distância e descrição parecida (ao menos uma palavra em comum,
 * parcial). Se achar, marca a parcela como paga. Não cria lançamento.
 */
async function conciliarBoleto(db: any, p: { userId: string; grupoId: string | null; t: Transacao }): Promise<void> {
  const desc = p.t.description ?? "";
  if (p.t.status === "PENDING") return;
  const { data: ligada } = await db.from("pluggy_transacoes").select("parcela_conciliada_id").eq("transaction_id", p.t.id).maybeSingle();
  if (ligada?.parcela_conciliada_id) return;

  const valor = Math.abs(p.t.amount);
  const data = dataIso(p.t.date);
  const palavrasBoleto = palavrasDoNome(desc.replace(/^pagamento de boleto/i, ""));
  if (!palavrasBoleto.length) return;

  let q = db
    .from("despesas")
    .select("id, descricao, parcelas(id, vencimento, paga)")
    .eq("valor_total", valor)
    .eq("total_parcelas", 1)
    .is("cartao_id", null);
  q = p.grupoId ? q.eq("grupo_id", p.grupoId) : q.eq("created_by", p.userId).is("grupo_id", null);
  const { data: candidatas } = await q;

  let melhor: { id: string; dist: number } | null = null;
  for (const d of candidatas ?? []) {
    const palavrasDesp = palavrasDoNome(d.descricao ?? "");
    const bate = palavrasBoleto.some((a) => palavrasDesp.some((b) => a.includes(b) || b.includes(a)));
    if (!bate) continue;
    for (const par of d.parcelas ?? []) {
      if (par.paga) continue;
      const dist = Math.abs(Date.parse(par.vencimento) - Date.parse(data)) / 86400000;
      if (dist > 10) continue;
      if (!melhor || dist < melhor.dist) melhor = { id: par.id, dist };
    }
  }
  if (!melhor) return;
  await db.from("parcelas").update({ paga: true, data_pagamento: data }).eq("id", melhor.id);
  await db.from("pluggy_transacoes").update({ parcela_conciliada_id: melhor.id }).eq("transaction_id", p.t.id);
}

/**
 * PIX recebido que atende uma regra cadastrada pelo administrador (faixa de valor e intervalo de dias
 * em torno do dia previsto da receita fixa) confirma a receita daquela competência. A receita fixa
 * sai só daquele mês e entra o valor recebido, como lançamento vindo do Open Finance.
 */
async function aplicarRegrasPix(db: any, p: { userId: string; t: Transacao }): Promise<void> {
  if (p.t.status === "PENDING" || p.t.type !== "CREDIT") return;
  const { data: jaSubstituida } = await db.from("receitas").select("id").eq("pluggy_transaction_id", p.t.id).maybeSingle();
  if (jaSubstituida) return;

  const valor = Math.abs(p.t.amount);
  const dataTx = dataIso(p.t.date);
  const { data: regras } = await db.from("regras_pix_receita").select("*").eq("ativo", true).eq("created_by", p.userId);
  for (const regra of regras ?? []) {
    if (valor < Number(regra.valor_minimo) || valor > Number(regra.valor_maximo)) continue;

    const { data: serie } = await db
      .from("receitas")
      .select("*")
      .eq("recorrente", true)
      .eq("created_by", p.userId)
      .eq("descricao", regra.receita_descricao)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!serie) continue;

    const inicio = String(serie.recorrencia_inicio ?? serie.data_recebimento ?? "");
    const diaPrevisto = Number(inicio.slice(8, 10));
    if (!diaPrevisto) continue;
    // Dia previsto na competência do PIX (e na anterior, se a data cruzar o mês).
    const candidatas = [dataTx.slice(0, 7), somarMeses(dataTx, -1).slice(0, 7)].map(
      (comp) => `${comp}-${String(diaPrevisto).padStart(2, "0")}`,
    );
    const previsto = candidatas
      .map((iso) => ({ iso, dist: Math.abs(Date.parse(iso) - Date.parse(dataTx)) / 86400000 }))
      .filter((c) => !Number.isNaN(c.dist) && c.dist <= Number(regra.dias_tolerancia))
      .sort((a, b) => a.dist - b.dist)[0];
    if (!previsto) continue;

    const competencia = previsto.iso.slice(0, 7);
    try {
      await excluirReceitaSerie(db, serie, competencia, "so_competencia");
    } catch {
      continue; // competência já fora da série (já confirmada ou anterior ao início): não mexe
    }
    const { data: criada, error } = await db.from("receitas").insert({
      descricao: serie.descricao,
      valor,
      moeda: "BRL",
      categoria: serie.categoria ?? "Outras receitas",
      data_recebimento: dataTx,
      recorrente: false,
      responsavel: serie.responsavel ?? null,
      origem: "pluggy",
      pluggy_transaction_id: p.t.id,
      importada_em: new Date().toISOString(),
      congelada: false,
      possivel_duplicidade: false,
      created_by: serie.created_by,
      grupo_id: serie.grupo_id,
    }).select("id").single();
    if (error) throw new Error("Falha ao confirmar a receita pelo PIX.");
    // Aba PIX (24/10/2026): o PIX aplicado pela regra aparece como já lançado.
    await db
      .from("pluggy_transacoes")
      .update({ pix_situacao: "lancado", pix_lancamento_id: criada?.id ?? null, pix_tratado_em: new Date().toISOString() })
      .eq("transaction_id", p.t.id);
    return;
  }
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
  await espelharInvestimentos(db, userId, r.results ?? []);
}

/** Tipo da tela de Investimentos a partir do tipo e subtipo da Pluggy. */
function tipoDoInvestimento(i: Investimento & { subtype?: string }): string {
  const sub = String(i.subtype ?? "").toUpperCase();
  const tipo = String(i.type ?? "").toUpperCase();
  if (sub.includes("TREASURY")) return "Tesouro Direto";
  if (sub.includes("REAL_ESTATE")) return "FIIs";
  if (sub.includes("SAVING") || /poupan/i.test(i.name ?? "")) return "Poupança";
  if (tipo === "FIXED_INCOME") return "Renda fixa";
  if (tipo === "EQUITY" || tipo === "ETF") return "Ações";
  return "Outro";
}

/**
 * Pedido de 24/10/2026: investimentos do Open Finance entram na tela de Investimentos (site e app)
 * e no total. Cada aplicação vira (ou atualiza) uma linha em `investimentos` com origem "pluggy";
 * a pessoa pode ligar a linha a um investimento que já tinha cadastrado, para não contar duas vezes.
 * Só o valor atual é atualizado nas sincronizações seguintes.
 */
async function espelharInvestimentos(db: any, userId: string, lista: Investimento[]) {
  const { data: perfil } = await db.from("profiles").select("grupo_id, nome").eq("id", userId).maybeSingle();
  if (!perfil?.grupo_id) return;
  const hoje = new Date().toISOString().slice(0, 10);
  for (const i of lista) {
    const saldo = Number(i.balance ?? 0) || 0;
    const { data: existente, error: erroBusca } = await db
      .from("investimentos")
      .select("id")
      .eq("pluggy_investimento_id", i.id)
      .maybeSingle();
    if (erroBusca) return; // coluna ainda não criada no banco: não derruba a sincronização
    if (existente) {
      await db.from("investimentos").update({ valor_atual: Math.max(0, saldo) }).eq("id", existente.id);
      continue;
    }
    if (!(saldo > 0)) continue;
    const aplicado = Number(i.amountOriginal ?? 0) || saldo;
    await db.from("investimentos").insert({
      nome: i.name ?? "Investimento",
      tipo: tipoDoInvestimento(i as any),
      instituicao: i.issuer ?? null,
      valor_investido: aplicado,
      valor_atual: saldo,
      data_investimento: data10((i as any).date) ?? hoje,
      responsavel: perfil.nome ?? null,
      observacoes: "Importado pelo Open Finance. O valor atual é atualizado a cada sincronização.",
      origem: "pluggy",
      pluggy_investimento_id: i.id,
      created_by: userId,
      grupo_id: perfil.grupo_id,
    });
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

  // Trava por conexão: webhook e cron podem chegar juntos; só um processa por vez.
  const { data: travou } = await db
    .from("pluggy_items")
    .update({ sincronizando_em: new Date().toISOString() })
    .eq("item_id", itemId)
    .or(`sincronizando_em.is.null,sincronizando_em.lt.${new Date(Date.now() - TRAVA_MINUTOS * 60000).toISOString()}`)
    .select("item_id");
  if (!travou?.length) return { ignorado: true, transacoes: 0, primeira: false, criadas: 0 };
  try {
    return await sincronizarItemTravado(db, itemId, meu);
  } finally {
    await db.from("pluggy_items").update({ sincronizando_em: null }).eq("item_id", itemId);
  }
}

async function sincronizarItemTravado(
  db: any,
  itemId: string,
  meu: { user_id: string; conector: string | null; sincronizado_em: string | null },
): Promise<{ ignorado: boolean; transacoes: number; primeira: boolean; criadas: number }> {
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
      .update({
        status: "ok",
        terminado_em: new Date().toISOString(),
        transacoes_lidas: r.transacoes,
        despesas_criadas: r.criadas,
        mensagem: `faturas do banco: ${DIAG.faturas} · compras novas na fatura do banco: ${DIAG.comFatura} · sem fatura: ${DIAG.semFatura}`,
      })
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

async function executarSincronizacao(
  db: any,
  itemId: string,
  meu: { user_id: string; conector: string | null },
  primeira: boolean,
): Promise<{ ignorado: boolean; transacoes: number; primeira: boolean; criadas: number }> {
  DIAG.faturas = 0;
  DIAG.comFatura = 0;
  DIAG.semFatura = 0;
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
  // Intervalo de dias para substituir manual de cartão pelo Open Finance (configurado pelo admin).
  const { data: cfgDias } = await db
    .from("configuracoes_open_finance")
    .select("valor")
    .eq("chave", "dias_substituicao_cartao")
    .maybeSingle();
  const diasTolerancia = Number.isInteger(cfgDias?.valor) ? Number(cfgDias.valor) : 3;
  let total = 0;
  let criadas = 0;
  let contasRepetidas = 0;

  // Saldo de conta corrente por banco (somado entre as contas do mesmo banco).
  const saldoPorBanco = new Map<string, number>();
  for (const conta of contas.results ?? []) {
    // Banco conectado duas vezes (caso Itaú 2026-10): a mesma conta (tipo + número) já vem de outra
    // conexão ativa do usuário. Ignora aqui para não duplicar despesas, receitas e investimentos.
    if (conta.number) {
      // Dona da conta: a conexão mais antiga. A mais nova pula a conta e marca a sua cópia como inativa.
      // Vale para o grupo (conta conjunta conectada por duas pessoas da família também não duplica).
      let q = db
        .from("pluggy_contas")
        .select("item_id")
        .eq("tipo", conta.type ?? "BANK")
        .eq("numero_conta", conta.number)
        .eq("ativo", true)
        .neq("item_id", itemId);
      q = grupoId ? q.eq("grupo_id", grupoId) : q.eq("user_id", meu.user_id);
      const { data: outras } = await q;
      const ids = [...new Set(((outras ?? []) as { item_id: string }[]).map((o) => o.item_id))];
      if (ids.length) {
        const { data: itens } = await db.from("pluggy_items").select("item_id, criado_em").in("item_id", [...ids, itemId]);
        const vivos = (itens ?? []) as { item_id: string; criado_em: string | null }[];
        const meuItem = vivos.find((x) => x.item_id === itemId);
        const maisAntigaOutra = vivos
          .filter((x) => x.item_id !== itemId)
          .sort((a, b) => String(a.criado_em ?? "").localeCompare(String(b.criado_em ?? "")))[0];
        const souDona = !maisAntigaOutra || String(meuItem?.criado_em ?? "9") <= String(maisAntigaOutra.criado_em ?? "9");
        if (!souDona) {
          await db.from("pluggy_contas").update({ ativo: false }).eq("account_id", conta.id);
          contasRepetidas++;
          continue;
        }
      }
    }
    const cartaoFinal = conta.type === "CREDIT" ? ultimos4(conta.number) : null;
    const nomeConta = (conta.name ?? conta.marketingName ?? "").trim();
    let bancoId: string | null = null;
    let bancoNome: string | null = null;
    let cartaoId: string | null = null;
    if (conta.type === "CREDIT" && cartaoFinal) {
      // Cartão: identifica o banco pelo nome (sem criar banco) e cria/atualiza o cartão com os dados da Pluggy.
      const bancoCartao = await garantirBanco(db, { grupoId, nome: nomeConta, criar: false });
      bancoId = bancoCartao?.id ?? null;
      bancoNome = bancoCartao?.nome ?? null;
      const cartao = await garantirCartao(db, {
        grupoId,
        final: cartaoFinal,
        nome: nomeConta || `Cartão ${cartaoFinal}`,
        bandeira: marcaCartao(conta.creditData?.brand),
        limite: conta.creditData?.creditLimit ?? null,
        diaVencimento: diaDe(conta.creditData?.balanceDueDate),
        titular: (conta.owner ?? nomeConta) || "Titular",
        bancoId,
      });
      cartaoId = cartao.id;
      // Banco do cartão: o que já está cadastrado no cartão tem prioridade sobre o nome da conta.
      bancoId = cartao.bancoId;
      bancoNome = bancoId ? await nomeDoBanco(db, bancoId) : null;
      // Cartões adicionais da mesma conta viram cartões próprios, no mesmo banco e com o mesmo vencimento.
      // O limite é compartilhado com o principal: não é repetido no adicional, para não duplicar a soma.
      const nomeBase = nomeConta || `Cartão ${cartaoFinal}`;
      for (const adicional of conta.creditData?.additionalCards ?? []) {
        const finalAdicional = ultimos4(adicional.number);
        if (!finalAdicional || finalAdicional === cartaoFinal) continue;
        await garantirCartao(db, {
          grupoId,
          final: finalAdicional,
          nome: `${nomeBase} adicional ${finalAdicional}`,
          bandeira: marcaCartao(conta.creditData?.brand),
          limite: null,
          diaVencimento: diaDe(conta.creditData?.balanceDueDate),
          titular: (conta.owner ?? nomeConta) || "Titular",
          bancoId,
        });
      }
    } else if (conta.type !== "CREDIT") {
      // Conta corrente / poupança: cria o banco se ainda não existe.
      const bancoConta = await garantirBanco(db, {
        grupoId,
        nome: nomeConta,
        criar: true,
        titular: conta.owner ?? null,
        numero: conta.number ?? null,
      });
      bancoId = bancoConta?.id ?? null;
      bancoNome = bancoConta?.nome ?? null;
      if (bancoId) saldoPorBanco.set(bancoId, (saldoPorBanco.get(bancoId) ?? 0) + Number(conta.balance ?? 0));
    }
    const banco = bancoNome ?? (nomeConta || null);

    const { error: erroConta } = await db.from("pluggy_contas").upsert(
      {
        user_id: meu.user_id,
        grupo_id: grupoId,
        item_id: itemId,
        account_id: conta.id,
        tipo: conta.type ?? "BANK",
        nome: conta.name ?? null,
        cartao_final: cartaoFinal,
        banco_id: bancoId,
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
    const inicioConta = new Date().toISOString();
    const faturas = conta.type === "CREDIT" ? await faturasDoCartao(key, conta.id) : new Map<string, string>();
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
      // Conta corrente (BANK): PIX, transferências e saldo ficam só em pluggy_transacoes.
      // O Control ALL ainda não funciona como conta corrente, então nada vira despesa ou receita.
      if (conta.type !== "CREDIT") {
        for (const t of lista) {
          if (t.type === "DEBIT") await conciliarBoleto(db, { userId: meu.user_id, grupoId, t });
          else if (t.type === "CREDIT") await aplicarRegrasPix(db, { userId: meu.user_id, t });
        }
        if (!r.next) break;
        const m = /after=([^&]+)/.exec(r.next);
        depois = m ? decodeURIComponent(m[1]!) : null;
        if (!depois) break;
        continue;
      }
      for (const t of lista) {
        // Cartão: a compra pendente (fatura aberta) também entra; ver adotarPendente.
        const pendente = t.status === "PENDING";
        if (t.type !== "DEBIT") continue;
        if (CATEGORIAS_NAO_DESPESA.has((t.category ?? "").trim().toLowerCase())) continue;
        if (DESCRICAO_NAO_DESPESA.test(t.description ?? "")) continue;
        if (await importarDespesa(db, { userId: meu.user_id, grupoId, t, cartaoId, cartaoFinal, banco, congelada: pendente ? false : primeira, diasTolerancia, pendente, faturas })) criadas++;
      }
      if (!r.next) break;
      const m = /after=([^&]+)/.exec(r.next);
      depois = m ? decodeURIComponent(m[1]!) : null;
      if (!depois) break;
    }
    if (conta.type === "CREDIT") await limparPendentesSumidas(db, conta.id, de, inicioConta);
  }

  for (const [id, saldo] of saldoPorBanco) {
    const { error } = await db.from("bancos").update({ saldo_atual: saldo }).eq("id", id);
    if (error) throw new Error("Falha ao atualizar o saldo do banco.");
  }
  // Conexão que só repete contas de outra: não traz investimentos nem empréstimos de novo.
  const soRepetida = (contas.results ?? []).length > 0 && contasRepetidas === (contas.results ?? []).length;
  if (!soRepetida) {
    await sincronizarInvestimentos(db, key, itemId, meu.user_id);
    await sincronizarEmprestimos(db, key, itemId, meu.user_id);
  }
  await db.from("pluggy_items").update({ sincronizado_em: new Date().toISOString() }).eq("item_id", itemId);
  return { ignorado: false, transacoes: total, primeira, criadas };
}
