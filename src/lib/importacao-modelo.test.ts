import { describe, expect, test } from "bun:test";

import { FATURAS_ANONIMIZADAS } from "./importacao-fixtures";
import {
  classificarTipoSemantico,
  extrairFinalCartaoSeguro,
  extrairParcelaSegura,
  lerValorMonetario,
  normalizarCentavosPorTipo,
} from "./importacao-modelo";

describe("valores monetários em centavos", () => {
  test.each([
    ["R$ 1.234,56", 123456, "positivo"],
    ["-R$ 1.234,56", 123456, "negativo_prefixo"],
    ["1.234,56-", 123456, "negativo_sufixo"],
    ["(1.234,56)", 123456, "parenteses"],
    ["−R$ 12,08", 1208, "negativo_prefixo"],
    ["US$ 10.50", 1050, "positivo"],
  ] as const)("lê %s sem ponto flutuante", (texto, centavos, sinal) => {
    const resultado = lerValorMonetario(texto);
    expect(resultado?.centavosAbsolutos).toBe(centavos);
    expect(resultado?.sinalOriginal).toBe(sinal);
  });

  test("não aceita conteúdo monetário inválido", () => {
    expect(lerValorMonetario("R$ valor")).toBeNull();
  });
});

describe("classificação semântica e sinal interno", () => {
  test("seção tem prioridade sobre o sinal bruto", () => {
    const tipo = classificarTipoSemantico("10/08 PAGAMENTO RECEBIDO -R$ 500,00", "Pagamentos");
    expect(tipo).toBe("pagamento");
    expect(normalizarCentavosPorTipo(50000, tipo)).toBe(50000);
  });

  test("estorno permanece distinto de pagamento", () => {
    const tipo = classificarTipoSemantico("Estorno de compra 25,00", "Créditos");
    expect(tipo).toBe("estorno");
    expect(normalizarCentavosPorTipo(2500, tipo)).toBe(2500);
  });

  test("compra é negativa no modelo interno", () => {
    const tipo = classificarTipoSemantico("Loja teste 85,42", "Despesas");
    expect(tipo).toBe("compra");
    expect(normalizarCentavosPorTipo(8542, tipo)).toBe(-8542);
  });
});

describe("parcelas e cartões", () => {
  test.each([
    ["Petz parcela 2/3", { atual: 2, total: 3 }],
    ["Petz PARC. 01 DE 03", { atual: 1, total: 3 }],
    ["Petz 01D03", { atual: 1, total: 3 }],
  ])("reconhece %s", (texto, esperado) => {
    expect(extrairParcelaSegura(texto)).toEqual(esperado);
  });

  test("não confunde data com parcela", () => {
    expect(extrairParcelaSegura("Compra em 08/08")).toBeNull();
  });

  test.each([
    ["Cartão •••• 5360", "5360"],
    ["XXXX 6975", "6975"],
    ["****.4349", "4349"],
    ["6550.****.****.6274", "6274"],
  ])("extrai o final de %s", (texto, final) => {
    expect(extrairFinalCartaoSeguro(texto)).toBe(final);
  });
});

describe("amostras anonimizadas", () => {
  test("incluem os quatro emissores e um layout desconhecido", () => {
    expect(Object.keys(FATURAS_ANONIMIZADAS)).toEqual([
      "itau",
      "nubank",
      "santander",
      "pernambucanas",
      "desconhecido",
    ]);
  });

  test("não contêm CPF nem número completo de cartão", () => {
    const texto = Object.values(FATURAS_ANONIMIZADAS).flat().join("\n");
    expect(texto).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    expect(texto).not.toMatch(/\b\d{16}\b/);
  });
});