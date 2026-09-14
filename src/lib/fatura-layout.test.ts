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
