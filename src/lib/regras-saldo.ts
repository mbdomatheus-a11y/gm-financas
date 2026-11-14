/**
 * Regras de saldo (07/11/2026), tela Personalização > "Saldos e valores".
 * Funções puras, sem banco: o site (src/lib/regras-saldo.ts) e o app (controlall/src/lib/regras-saldo.ts)
 * usam o MESMO arquivo, para os dois mostrarem o mesmo número.
 *
 * Onde cada regra vale:
 *  - somar_pagamento_fatura: contaComoDespesa() em relatorios.ts (despesasPorCompetencia), previsao-mes.ts /
 *    painel.ts (previsão e saldo do mês), dashboard / Início e "Para onde vai".
 *  - somar_investimentos: totaisInvestimentos() no Resumo dos relatórios e no saldo do mês do dashboard / Início;
 *    movimentosNoSaldo() na aba Saldo dos relatórios.
 *  - somar_transferencias: aba Saldo dos relatórios (saldoDiario, opção transferencias).
 *  - mostrar_fatura_aberta: previsão do mês (calcularPrevisaoMes / calcularPainel).
 */

/** Texto em maiúsculas, sem acento e sem pontuação, para comparar descrições. */
function normalizarTexto(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Descrições de pagamento de fatura, como os bancos e as importações escrevem
 * (mesmas palavras de detectarTipoLancamento em categorizacao.ts e do "credit card payment" da Pluggy):
 * "PAGAMENTO DE FATURA", "PAG FATURA", "PGTO FATURA NUBANK", "PAGAMENTO CARTAO DE CREDITO",
 * "DEBITO AUTOMATICO FATURA", "FATURA DO CARTAO", "CREDIT CARD PAYMENT".
 * "Fatura Nubank" (sem cartão e fora das origens de total de fatura) também entra, via PADRAO_FATURA_BANCO.
 */
const PADRAO_PAGAMENTO_FATURA =
  /\b(PAGAMENTO|PAGTO|PGTO|PAG|PGT)\s+(D[AEO]S?\s+)?(FATURA|CARTAO|CARTOES)\b|\bDEBITO\s+AUTOMATICO\s+(D[AEO]\s+)?(FATURA|CARTAO)\b|\bFATURA\s+(D[OE]\s+)?CARTAO\b|\bCREDIT\s+CARD\s+PAYMENT\b/;

/** Origens que SÃO a despesa do cartão (total da fatura no lugar das compras): nunca são pagamento. */
/**
 * "Fatura <banco>" no começo da descrição ("Fatura Itaú", "FATURA NUBANK"): pagamento vindo do Open Finance ou lançado à mão.
 * Só vale para lançamento fora de cartão (sem cartao_id): compra no cartão chamada "Fatura X" não é pagamento.
 */
const PADRAO_FATURA_BANCO = /^FATURA\s+(D[AEO]S?\s+)?[A-Z0-9]+( [A-Z0-9]+){0,3}$/;

const ORIGENS_FATURA_DO_CARTAO = new Set(["fatura_rapida", "fatura_total_manual", "fatura_total_concluida"]);

/**
 * Lançamento que é pagamento de fatura de cartão (saída da conta para quitar a fatura).
 * As compras do cartão já contam como despesa; somar o pagamento contaria o mesmo dinheiro duas vezes.
 * Aceita a despesa (linha de "despesas") ou a parcela com `despesa` dentro.
 */
export function ehPagamentoDeFatura(despesa: any): boolean {
  const d = despesa?.despesa ?? despesa;
  if (!d) return false;
  if (d.direcao === "credito") return false;
  if (ORIGENS_FATURA_DO_CARTAO.has(String(d.origem ?? ""))) return false;
  if (!d.cartao_id && [d.descricao, d.estabelecimento].some((t) => PADRAO_FATURA_BANCO.test(normalizarTexto(t)))) return true;
  if (String(d.categoria_pluggy ?? "").toLowerCase() === "credit card payment") return true;
  return [d.descricao, d.estabelecimento, d.categoria, d.subcategoria].some((t) =>
    PADRAO_PAGAMENTO_FATURA.test(normalizarTexto(t)),
  );
}

/**
 * Regra "Somar pagamento de fatura": desligada (padrão), o pagamento de fatura fica fora dos totais de
 * despesas e só as compras do cartão contam; ligada, ele conta como saída.
 */
export function contaComoDespesa(despesa: any, somarPagamentoFatura?: boolean | null): boolean {
  return Boolean(somarPagamentoFatura) || !ehPagamentoDeFatura(despesa);
}

export type MovimentoInvestimento = { data: string; tipo: string; valor: number };

/**
 * Movimentos de investimento (tabela investimento_movimentos), achatados a partir de
 * investimentos com `investimento_movimentos(*)` ou de uma lista de movimentos.
 */
export function movimentosDeInvestimentos(lista: any[] | null | undefined): MovimentoInvestimento[] {
  const out: MovimentoInvestimento[] = [];
  for (const x of lista ?? []) {
    // Investimento com a lista embutida, ou o próprio movimento (tem investimento_id).
    const movs = Array.isArray(x?.investimento_movimentos) ? x.investimento_movimentos : x?.investimento_id ? [x] : [];
    for (const m of movs) {
      const data = String(m?.data ?? "").slice(0, 10);
      const valor = Math.abs(Number(m?.valor) || 0);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || valor <= 0 || !m?.tipo) continue;
      out.push({ data, tipo: String(m.tipo), valor });
    }
  }
  return out;
}

/** Aporte sai do saldo; resgate (e rendimento recebido) entra. */
export function sentidoDoMovimento(tipo: string): "entrada" | "saida" {
  return /aporte|aplica/i.test(tipo) ? "saida" : "entrada";
}

/**
 * Regra "Somar investimentos": totais dos movimentos cujas datas passam no filtro (ex.: competência do mês).
 * Desligada (padrão), quem chama não usa esta função e nada muda.
 */
export function totaisInvestimentos(
  movimentos: MovimentoInvestimento[],
  noPeriodo: (data: string) => boolean,
): { entradas: number; saidas: number } {
  let entradas = 0;
  let saidas = 0;
  for (const m of movimentos) {
    if (!noPeriodo(m.data)) continue;
    if (sentidoDoMovimento(m.tipo) === "saida") saidas += m.valor;
    else entradas += m.valor;
  }
  return { entradas, saidas };
}
