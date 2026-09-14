import { describe, expect, test } from "bun:test";

import { ehValorCredito } from "./lancamento-direcao";

describe("ehValorCredito", () => {
  test("sinal-atrás '-' é despesa comum (caso real Elo/Pernambucanas)", () => {
    expect(ehValorCredito("50,04-", "PERNAMBUCANAS 377 PARC.9/10")).toBe(false);
  });

  test("sinal-atrás '+' é crédito, mesmo sem palavra-chave de estorno (caso real: refund do iFood)", () => {
    expect(ehValorCredito("1,00+", "IFD IFOOD")).toBe(true);
  });

  test("sinal-atrás '+' em pagamento de fatura é crédito", () => {
    expect(ehValorCredito("459,96+", "PAGAMENTO FATURA CONTA DIGITAL")).toBe(true);
  });

  test("sinal só à frente (sem sinal atrás) é crédito — notação matemática comum", () => {
    expect(ehValorCredito("-R$ 50,00", "ALGUMA COMPRA")).toBe(true);
  });

  test("valor entre parênteses é crédito — notação contábil", () => {
    expect(ehValorCredito("(50,00)", "ALGUMA COMPRA")).toBe(true);
  });

  test("sem sinal nenhum: decide só por palavra-chave", () => {
    expect(ehValorCredito("50,00", "PAGAMENTO RECEBIDO")).toBe(true);
    expect(ehValorCredito("50,00", "SUPERMERCADO PAO DE ACUCAR")).toBe(false);
  });

  test("palavra-chave 'estorno' é crédito mesmo com sinal-atrás '-' (raro, mas a palavra-chave não é ignorada)", () => {
    expect(ehValorCredito("50,00-", "ESTORNO COMPRA DUPLICADA")).toBe(true);
  });

  test("reconhece as demais palavras-chave de crédito", () => {
    for (const desc of [
      "DEVOLUCAO PRODUTO",
      "CASHBACK PROGRAMA FIDELIDADE",
      "REEMBOLSO VIAGEM",
      "AJUSTE A CREDITO",
      "CREDITO RECEBIDO",
    ]) {
      expect(ehValorCredito("50,00", desc)).toBe(true);
    }
  });

  test("compra comum sem sinal nenhum não é crédito", () => {
    expect(ehValorCredito("R$ 50,00", "PADARIA DO BAIRRO")).toBe(false);
  });
});
