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
  creditData?: { brand?: string; creditLimit?: number; availableCreditLimit?: number; balanceDueDate?: string; minimumPayment?: number };
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
  let q = db.from("bancos").select("id, nome");
  q = p.grupoId ? q.eq("grupo_id", p.grupoId) : q.is("grupo_id", null);
  const { data: lista } = await q;
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
): Promise<string> {
  let q = db.from("cartoes").select("id, banco_id").eq("final", p.final);
  q = p.grupoId ? q.eq("grupo_id", p.grupoId) : q.is("grupo_id", null);
  const { data: existente } = await q.limit(1).maybeSingle();
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
  // As parcelas podem cair em dias diferentes do mesmo mês (ex.: 03/09 e 11/09), então a compra
  // é identificada pelo mês da primeira parcela, e não pelo dia.
  const primeiraMes = primeira.slice(0, 7);
  const grupo = `${p.cartaoFinal ?? p.banco ?? "x"}|${nucleo}|${t}|${valorParcela.toFixed(2)}|${primeira}`;

  let jaMes = db
    .from("despesas")
    .select("id")
    .eq("total_parcelas", t)
    .eq("descricao", nucleo || p.t.description)
    .gte("data_primeira_parcela", `${primeiraMes}-01`)
    .lt("data_primeira_parcela", `${somarMeses(`${primeiraMes}-01`, 1)}`)
    .limit(1);
  jaMes = p.cartaoFinal
    ? jaMes.eq("cartao_final", p.cartaoFinal)
    : p.banco
      ? jaMes.eq("banco_nome", p.banco)
      : jaMes.is("banco_nome", null);
  const { data: jaCompra } = await jaMes.maybeSingle();
  if (jaCompra) return false;
  const { data: jaGrupo } = await db.from("despesas").select("id").eq("pluggy_grupo", grupo).maybeSingle();
  if (jaGrupo) return false;

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
 * Cria a despesa importada, ou troca o lançamento manual igual por ela.
 * Pula lançamentos já importados e os rejeitados pelo usuário.
 */
async function importarDespesa(
  db: any,
  p: { userId: string; grupoId: string | null; t: Transacao; cartaoId: string | null; cartaoFinal: string | null; banco: string | null; congelada: boolean; diasTolerancia: number },
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
    vencimento: await vencimentoCartao(db, p.cartaoId, p.t.date),
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
    const { error } = await db.from("receitas").insert({
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
    });
    if (error) throw new Error("Falha ao confirmar a receita pelo PIX.");
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
  // Intervalo de dias para substituir manual de cartão pelo Open Finance (configurado pelo admin).
  const { data: cfgDias } = await db
    .from("configuracoes_open_finance")
    .select("valor")
    .eq("chave", "dias_substituicao_cartao")
    .maybeSingle();
  const diasTolerancia = Number.isInteger(cfgDias?.valor) ? Number(cfgDias.valor) : 3;
  let total = 0;
  let criadas = 0;

  // Saldo de conta corrente por banco (somado entre as contas do mesmo banco).
  const saldoPorBanco = new Map<string, number>();
  for (const conta of contas.results ?? []) {
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
      cartaoId = await garantirCartao(db, {
        grupoId,
        final: cartaoFinal,
        nome: nomeConta || `Cartão ${cartaoFinal}`,
        bandeira: marcaCartao(conta.creditData?.brand),
        limite: conta.creditData?.creditLimit ?? null,
        diaVencimento: diaDe(conta.creditData?.balanceDueDate),
        titular: (conta.owner ?? nomeConta) || "Titular",
        bancoId,
      });
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
        if (t.status === "PENDING") continue;
        if (t.type !== "DEBIT") continue;
        if (CATEGORIAS_NAO_DESPESA.has((t.category ?? "").trim().toLowerCase())) continue;
        if (DESCRICAO_NAO_DESPESA.test(t.description ?? "")) continue;
        if (await importarDespesa(db, { userId: meu.user_id, grupoId, t, cartaoId, cartaoFinal, banco, congelada: primeira, diasTolerancia })) criadas++;
      }
      if (!r.next) break;
      const m = /after=([^&]+)/.exec(r.next);
      depois = m ? decodeURIComponent(m[1]!) : null;
      if (!depois) break;
    }
  }

  for (const [id, saldo] of saldoPorBanco) {
    const { error } = await db.from("bancos").update({ saldo_atual: saldo }).eq("id", id);
    if (error) throw new Error("Falha ao atualizar o saldo do banco.");
  }
  await sincronizarInvestimentos(db, key, itemId, meu.user_id);
  await sincronizarEmprestimos(db, key, itemId, meu.user_id);
  await db.from("pluggy_items").update({ sincronizado_em: new Date().toISOString() }).eq("item_id", itemId);
  return { ignorado: false, transacoes: total, primeira, criadas };
}
