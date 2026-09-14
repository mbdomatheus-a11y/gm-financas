import { describe, expect, test } from "bun:test";

import { agruparLinhas, extrairPosicional, type ItemPdf } from "./fatura-layout";

/**
 * Regressão do bug de PDFs em duas colunas: um painel (limites, encargos,
 * saldo futuro) ao lado da tabela de lançamentos faz `agruparLinhas` colar,
 * numa mesma "linha", texto de colunas sem nenhuma relação só porque calhou
 * de ter o mesmo Y — derrubando ou embaralhando transações reais. Ver
 * `extrairPosicional` para o mecanismo de "resgate".
 *
 * As coordenadas usadas aqui replicam, de forma simplificada, as extraídas
 * de uma fatura real da Pernambucanas/Elo onde esse bug foi encontrado (17
 * lançamentos reais, dos quais 10 eram perdidos antes da correção).
 */

function item(str: string, x: number, y: number, w = str.length * 4, page = 1): ItemPdf {
  return { str, x, y, w, page };
}

describe("agruparLinhas", () => {
  test("agrupa fragmentos próximos em y na mesma linha, ordenados por x", () => {
    const linhas = agruparLinhas([
      item("Loja", 100, 700),
      item("01/03/2026", 50, 700),
      item("50,00-", 500, 700),
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.texto).toBe("01/03/2026 Loja 50,00-");
  });

  test("separa em linhas diferentes quando o y muda além da tolerância", () => {
    const linhas = agruparLinhas([item("Linha 1", 50, 700), item("Linha 2", 50, 690)]);
    expect(linhas).toHaveLength(2);
  });
});

describe("extrairPosicional — layout normal (uma coluna)", () => {
  test("extrai um lançamento simples", () => {
    const r = extrairPosicional(
      [item("01/03/2026", 50, 700), item("Loja Exemplo", 110, 700), item("123,45-", 500, 700)],
      "2026-03-15",
    );
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]).toMatchObject({
      data_compra: "2026-03-01",
      descricao: "Loja Exemplo",
      valor: 123.45,
      direcao: "debito",
    });
  });
});

describe("extrairPosicional — resgate de transação colada (bug das duas colunas)", () => {
  test("recupera transação com termo de ruído ('limite') colado na frente", () => {
    // Réplica do caso real: "Limite Rotativo R$ 11.200,00 21/01/2026 Porto
    // Seguro PARC.8/12 27,59-" — sem o resgate, `ehLinhaResumoFatura`
    // derruba a linha inteira por causa da palavra "limite".
    const itens = [
      item("Limite Rotativo", 50, 700),
      item("R$ 11.200,00", 150, 700),
      item("21/01/2026", 303, 700),
      item("Porto Seguro PARC.8/12", 340, 700),
      item("27,59-", 530, 700),
    ];
    const r = extrairPosicional(itens, "2026-02-15");
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]).toMatchObject({
      data_compra: "2026-01-21",
      valor: 27.59,
      direcao: "debito",
      parcela_numero: 8,
      parcela_total: 12,
    });
    expect(r.lancamentos[0]!.descricao).toContain("Porto Seguro");
  });

  test("não deixa uma linha mesclada travar o resto do documento em 'seção ignorada'", () => {
    // Réplica do caso real: "Saldo Futuro a Vencer R$ 1.414,06" (que dispara
    // SECAO_IGNORADA) colado com uma transação de verdade — mas com a data
    // da transação caindo numa "linha" separada (y ligeiramente diferente),
    // exatamente como aconteceu no PDF real. O resgate por posição de coluna
    // usa a coluna de descrição já aprendida de lançamentos anteriores no
    // mesmo documento (como acontece de fato: essa linha nunca é a primeira
    // do documento), por isso a fatura já tem uma transação normal antes.
    const itens = [
      item("21/07/2026", 303, 750),
      item("Compra Anterior", 340, 750),
      item("15,00-", 530, 750),
      item("Saldo Futuro a Vencer", 50, 644),
      item("R$ 1.414,06", 246, 644),
      item("PERNAMBUCANAS 72 PARC.2/5", 334, 644),
      item("SAO PAULO/Brasil", 453, 644),
      item("26,10-", 530, 644),
      // Data solta, 3pt abaixo — fora da tolerância de agrupamento (2.5),
      // vira uma "linha" só com a data, como no PDF real.
      item("31/07/2026", 303, 641),
      // Uma transação normal, bem depois, sem nenhuma relação com a anterior.
      item("05/09/2026", 303, 594),
      item("Loja Seguinte", 340, 594),
      item("10,00-", 530, 594),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(3);
    expect(r.lancamentos[1]).toMatchObject({
      data_compra: "2026-07-31",
      valor: 26.1,
      direcao: "debito",
    });
    expect(r.lancamentos[1]!.descricao).toContain("PERNAMBUCANAS");
    expect(r.lancamentos[2]).toMatchObject({
      data_compra: "2026-09-05",
      descricao: "Loja Seguinte",
      valor: 10,
    });
  });

  test("não confunde cabeçalho de período de encargos ('15/08 - 14/09') com a data da transação", () => {
    // Réplica do caso real: tabela de ENCARGOS (juros) colada com a linha de
    // pagamento — sem a proteção, a data virava "15/08" (do cabeçalho de
    // período) em vez de "17/08/2026" (a data real do pagamento).
    const itens = [
      item("15/08 - 14/09", 136, 608),
      item("15/09 - 14/10", 250, 608),
      item("17/08/2026", 350, 608),
      item("PAGAMENTO FATURA CONTA DIGITAL", 390, 608),
      item("459,96+", 526, 608),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]).toMatchObject({
      data_compra: "2026-08-17",
      valor: 459.96,
      direcao: "credito",
    });
    expect(r.lancamentos[0]!.descricao).not.toContain("14/09");
  });

  test("não resgata uma linha de resumo pura só porque tem data e valor", () => {
    // "Vencimento 15/08/2026 Valor Total R$ 1.234,56" não é uma transação —
    // é só um resumo com data e valor dentro. O trecho ENTRE a data e o
    // valor ("Valor Total") também é ruído, então não deve ser resgatado.
    const itens = [
      item("Loja Anterior", 100, 700),
      item("01/03/2026", 50, 700),
      item("50,00-", 500, 700),
      item("Vencimento", 50, 500),
      item("15/08/2026", 150, 500),
      item("Valor Total", 250, 500),
      item("R$ 1.234,56", 500, 500),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]!.descricao).toBe("Loja Anterior");
  });

  test("mantém exclusão de seção legitimamente ignorada (ex.: Próximas Faturas)", () => {
    const itens = [
      item("Próximas Faturas", 50, 800),
      item("15/10/2026", 303, 790),
      item("Compra Futura", 340, 790),
      item("50,00-", 530, 790),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(0);
  });
});

describe("extrairPosicional — regressão fatura Santander real (data colada na descrição)", () => {
  // O PDF do Santander sai do pdfjs com a data e o começo da descrição como
  // UM fragmento de texto só ("29/06 UNIDAS SEMINOVOS VVGL", um espaço
  // simples, não dois) — sem separar isso a data "engolia" a célula inteira
  // e a descrição sumia.
  test("separa data colada com a descrição num lançamento de uma coluna só", () => {
    const itens = [
      item("1", 16, 700),
      item("29/06 UNIDAS SEMINOVOS VVGL", 33, 700),
      item("03/12", 168, 700),
      item("1.666,66", 203, 700),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]).toMatchObject({
      data_compra: "2026-06-29",
      valor: 1666.66,
      parcela_numero: 3,
      parcela_total: 12,
    });
    expect(r.lancamentos[0]!.descricao).toContain("Unidas Seminovos Vvgl");
  });

  test("separa duas transações reais de titulares diferentes coladas na mesma linha, com data colada na descrição", () => {
    // Réplica da linha real: pagamento do titular principal (esquerda) e
    // despesa do titular adicional (direita) na mesma linha impressa,
    // ambos com data+descrição grudadas na própria célula.
    const itens = [
      item("17/08 DEB AUTOM DE FATURA EM C/", 33, 472),
      item("-3.953,64", 201, 472),
      item("3", 311, 472),
      item("12/08 VEND PERTO MACHINES", 327, 472),
      item("7,99", 508, 472),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(2);
    expect(r.lancamentos[0]).toMatchObject({
      data_compra: "2026-08-17",
      valor: 3953.64,
      direcao: "credito",
    });
    expect(r.lancamentos[0]!.descricao).toContain("Deb Autom");
    expect(r.lancamentos[1]).toMatchObject({ data_compra: "2026-08-12", valor: 7.99 });
    expect(r.lancamentos[1]!.descricao).toContain("Vend Perto Machines");
  });
});

describe("extrairPosicional — duas transações reais na mesma linha (tabela em duas colunas)", () => {
  test("separa duas transações independentes impressas lado a lado", () => {
    // Réplica de uma fatura real do Itaú: a tabela de lançamentos é impressa
    // em duas colunas lado a lado pra economizar espaço vertical — cada
    // linha traz DUAS transações reais e sem relação entre si. Sem separar,
    // vira uma descrição só: "PAG*RiotGameSa 02/03 44,30 14/08 DROGARIA SAO
    // PAULO 447S" (foi exatamente esse o relato do usuário: "misturando
    // tudo").
    const itens = [
      item("30/07", 133, 630),
      item("PAG*RiotGameSa 02/03", 161, 630),
      item("44,30", 314, 630),
      item("14/08", 351, 630),
      item("DROGARIA SAO PAULO 447S", 379, 630),
      item("79,49", 533, 630),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(2);
    expect(r.lancamentos[0]).toMatchObject({
      data_compra: "2026-07-30",
      valor: 44.3,
      parcela_numero: 2,
      parcela_total: 3,
    });
    expect(r.lancamentos[0]!.descricao).toContain("RiotGameSa");
    expect(r.lancamentos[1]).toMatchObject({
      data_compra: "2026-08-14",
      valor: 79.49,
      parcela_numero: 1,
      parcela_total: 1,
    });
    expect(r.lancamentos[1]!.descricao).toContain("Drogaria");
  });

  test("não separa uma linha normal de uma transação só (não acha duas datas)", () => {
    const itens = [
      item("01/03/2026", 50, 700),
      item("Loja Exemplo", 110, 700),
      item("123,45-", 500, 700),
    ];
    const r = extrairPosicional(itens, "2026-03-15");
    expect(r.lancamentos).toHaveLength(1);
  });
});

describe("extrairPosicional — regressão fatura Pernambucanas real (2026-09)", () => {
  // Réplica simplificada de uma fatura real onde a frase "Saldo Futuro a
  // Vencer (Compras Parceladas, Produtos e Serviços Financeiros) em
  // 12/09/2026" (só uma linha informativa do painel de limites, não o
  // início de uma seção de transações futuras de verdade) ficava colada, na
  // mesma linha impressa, com transações reais da tabela de lançamentos —
  // derrubando 8 das 17 transações da fatura porque a frase disparava o
  // modo de "seção ignorada" (pensado para casos como "Próximas Faturas",
  // que é uma seção real) e esse modo persistia até o fim do documento.
  test("não perde transações reais coladas com 'saldo futuro a vencer'", () => {
    const itens = [
      item("Saldo Futuro a Vencer (Compras Parceladas, Produtos e", 50, 626),
      item("Serviços Financeiros) em 12/09/2026", 50, 620),
      item("31/07/2026", 350, 620),
      item("72 PARC.2/5", 390, 620),
      item("SAO PAULO/SP", 470, 620),
      item("26,10-", 526, 620),
      item("03/08/2026", 350, 611),
      item("377 PARC.2/2", 390, 611),
      item("São Paulo/S", 470, 611),
      item("16,87-", 526, 611),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(2);
    expect(r.lancamentos[0]).toMatchObject({ data_compra: "2026-07-31", valor: 26.1 });
    expect(r.lancamentos[0]!.descricao).not.toContain("12/09/2026");
    expect(r.lancamentos[1]).toMatchObject({ data_compra: "2026-08-03", valor: 16.87 });
  });
});

describe("extrairPosicional — formato Nubank (data 'DD MES' + marcador '•••• NNNN')", () => {
  test("extrai uma compra parcelada com o marcador de cartão colado na linha", () => {
    const itens = [
      item("08 AGO", 40, 700),
      item("••••", 90, 700),
      item("5360", 120, 700),
      item("Petz - Parcela 2/3", 160, 700),
      item("R$ 122,08", 480, 700),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]).toMatchObject({
      data_compra: "2026-08-08",
      descricao: "Petz",
      valor: 122.08,
      parcela_numero: 2,
      parcela_total: 3,
      cartao_final: "5360",
      direcao: "debito",
    });
  });

  test("extrai um IOF sem marcador de cartão, com a descrição entre aspas", () => {
    const itens = [
      item("08 AGO", 40, 690),
      item('IOF de "Anthropic* Claude Sub"', 90, 690),
      item("R$ 3,99", 480, 690),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]!.descricao).not.toContain('"');
    expect(r.lancamentos[0]!.valor).toBe(3.99);
  });

  test("usa o valor final em BRL, não a taxa de conversão, numa compra internacional", () => {
    const itens = [
      item("08 AGO", 40, 680),
      item("••••", 90, 680),
      item("3310", 120, 680),
      item("Anthropic* Claude Sub BRL 110.00 = USD 21.52", 160, 680),
      item("Conversão: BRL 5.29 = USD 1", 420, 680),
      item("= R$ 5,29", 470, 680),
      item("R$ 113,94", 510, 680),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]!.valor).toBe(113.94);
    expect(r.lancamentos[0]!.descricao).toBe("Anthropic* Claude Sub");
    expect(r.lancamentos[0]!.cartao_final).toBe("3310");
  });
});

describe("extrairPosicional — resgate de transação colada (bug das duas colunas), continuação", () => {
  test("mantém exclusão de uma seção realmente futura mesmo com 'saldo futuro' ativo antes dela", () => {
    // Depois de uma linha de "saldo futuro" (agora sem efeito persistente),
    // uma seção "Próximas Faturas" de verdade continua sendo ignorada.
    const itens = [
      item("Saldo Futuro a Vencer", 50, 630),
      item("Próximas Faturas", 50, 610),
      item("15/10/2026", 303, 600),
      item("Compra Futura", 340, 600),
      item("50,00-", 530, 600),
    ];
    const r = extrairPosicional(itens, "2026-09-15");
    expect(r.lancamentos).toHaveLength(0);
  });
});
