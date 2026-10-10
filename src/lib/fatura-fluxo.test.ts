import { describe, expect, test } from "bun:test";

import type { ItemPdf } from "./fatura-layout";
import {
  extrairCabecalhoFatura,
  extrairPorFluxo,
  lerLinhaLancamento,
  mesmaPessoa,
  separarParcela,
} from "./fatura-fluxo";

/**
 * Cenários reproduzidos (dados fictícios) das faturas reais estudadas em
 * 2026-10-10: Itaú em duas colunas com adicional, bloco "Compras parceladas -
 * próximas faturas", Midway/Riachuelo com "valor original x lançamento do
 * mês", XP com colunas R$/US$ e Santander com cabeçalho por cartão.
 */
function it(str: string, x: number, y: number, page = 1): ItemPdf {
  return { str, x, y, w: str.length * 4.5, page };
}

describe("separarParcela", () => {
  test("parcela colada no fim do nome", () => {
    expect(separarParcela("ANUIDADE DIFERENCI01/12")).toEqual({
      descricao: "ANUIDADE DIFERENCI",
      parcela: { atual: 1, total: 12 },
    });
  });
  test("parcela separada por espaço e por '- Parcela'", () => {
    expect(separarParcela("OTB OUTLET PRE 01/07").parcela).toEqual({ atual: 1, total: 7 });
    expect(separarParcela("MR CAT CENTER 3 - Parcela 4/6")).toEqual({
      descricao: "MR CAT CENTER 3",
      parcela: { atual: 4, total: 6 },
    });
  });
  test("não confunde número do estabelecimento com parcela", () => {
    expect(separarParcela("IFD*61.203.833 ALINE RS").parcela).toBeNull();
    expect(separarParcela("DIA BRASIL 508").parcela).toBeNull();
  });
});

describe("lerLinhaLancamento", () => {
  test("Midway: usa o lançamento do mês, não o valor original", () => {
    const l = lerLinhaLancamento("18/07/26 009 LOJA EXEMPLO SHOP 429,96 02/03 + 143,32", {
      codigoLoja: true,
    })!;
    expect(l.descricao).toBe("LOJA EXEMPLO SHOP");
    expect(l.valorTexto).toBe("143,32");
    expect(l.parcela).toEqual({ atual: 2, total: 3 });
  });
  test("XP: coluna R$ antes da US$", () => {
    const l = lerLinhaLancamento("28/06/23 LOJA ONLINE -59,90 0,00")!;
    expect(l.valorTexto).toBe("-59,90");
  });
  test("Santander: nota de rodapé antes da data e parcela em coluna", () => {
    const l = lerLinhaLancamento("2 28/11 LOJA DE MOVEIS 11/12 164,08")!;
    expect(l.dia).toBe(28);
    expect(l.descricao).toBe("LOJA DE MOVEIS");
    expect(l.parcela).toEqual({ atual: 11, total: 12 });
  });
});

describe("extrairPorFluxo", () => {
  // Página com duas colunas: esquerda (titular + adicional), direita (continuação do adicional).
  const itens: ItemPdf[] = [
    it("Vencimento: 15/10/2026", 30, 800),
    it("Titular FULANO DE TAL", 30, 790),
    it("Cartão 1234.XXXX.XXXX.9120", 30, 780),
    it("Lançamentos: compras e saques", 133, 660),
    it("FULANO DE TAL", 133, 649),
    it("DATA", 133, 639),
    it("ESTABELECIMENTO", 161, 639),
    it("30/07", 133, 630),
    it("LOJA GAMES 03/03", 161, 630),
    it("44,30", 314, 630),
    it("loja Sao Paulo", 161, 620),
    it("Lançamentos no cartão", 133, 554),
    it("44,30", 309, 554),
    it("Ciclana Silva", 133, 529),
    it("DATA", 133, 519),
    it("ESTABELECIMENTO", 161, 519),
    it("20/08", 133, 509),
    it("LOJA ROUPAS 02/03", 161, 509),
    it("20,83", 315, 509),
    it("Lançamentos: compras e saques", 351, 719),
    it("DATA", 351, 708),
    it("ESTABELECIMENTO", 379, 708),
    it("16/09", 351, 699),
    it("MERCADO BAIRRO", 379, 699),
    it("12,95", 534, 699),
    it("Compras parceladas - próximas faturas", 351, 600),
    it("DATA", 351, 590),
    it("ESTABELECIMENTO", 379, 590),
    it("20/08", 351, 580),
    it("LOJA ROUPAS 03/03", 379, 580),
    it("20,83", 534, 580),
  ];

  test("lê na ordem do PDF, ignora próximas faturas e identifica portador e final", () => {
    const r = extrairPorFluxo(itens);
    expect(r.lancamentos.map((l) => [l.descricao, l.valor, l.responsavel, l.cartao_final])).toEqual([
      ["Loja Games", 44.3, "Fulano de Tal", "9120"],
      ["Loja Roupas", 20.83, "Ciclana Silva", null],
      ["Mercado Bairro", 12.95, "Ciclana Silva", null],
    ]);
    expect(r.lancamentos[0]!.parcela_numero).toBe(3);
    expect(r.ignorados).toBe(1);
  });

  test("cabeçalho: vencimento, titular e final", () => {
    const c = extrairCabecalhoFatura(itens);
    expect(c.vencimento).toBe("2026-10-15");
    expect(c.titular).toBe("Fulano de Tal");
    expect(c.cartao_final).toBe("9120");
  });

  test("ano da compra: mês depois do vencimento é do ano anterior", () => {
    const r = extrairPorFluxo([
      it("Vencimento: 15/10/2026", 30, 800),
      it("2 28/11 LOJA DE MOVEIS 11/12 164,08", 30, 700),
    ]);
    expect(r.lancamentos[0]!.data_compra).toBe("2025-11-28");
  });
});

test("mesmaPessoa compara primeiro e último nome", () => {
  expect(mesmaPessoa("FULANO B SILVA", "Fulano Beltrano da Silva")).toBe(true);
  expect(mesmaPessoa("Ciclana Silva", "Fulano Silva")).toBe(false);
});
