import { describe, expect, test } from "bun:test";
import { classificarItemNota, calcularDepreciacao } from "./nota-itens-classificacao";

describe("nota-itens-classificacao", () => {
  test("classifica feijoada como Alimentação / Restaurante", () => {
    const res = classificarItemNota("Feijoada Completa Individual");
    expect(res.categoria).toBe("Alimentação");
    expect(res.subcategoria).toBe("Restaurante");
  });

  test("classifica refrigerante como Alimentação / Lanchonete", () => {
    const res = classificarItemNota("Coca Cola 2L Pet");
    expect(res.categoria).toBe("Alimentação");
    expect(res.subcategoria).toBe("Lanchonete");
  });

  test("classifica notebook com sugestão de depreciação de 3 anos", () => {
    const res = classificarItemNota("Notebook Dell Inspiron 15");
    expect(res.categoria).toBe("Tecnologia / IA");
    expect(res.sugestaoDepreciacao?.meses).toBe(36);
    expect(res.sugestaoDepreciacao?.anos).toBe(3);
  });

  test("classifica smartphone com sugestão de depreciação de 2 anos", () => {
    const res = classificarItemNota("Smartphone Samsung Galaxy S23");
    expect(res.categoria).toBe("Telefonia / Internet");
    expect(res.sugestaoDepreciacao?.meses).toBe(24);
  });

  test("calcula depreciação linear corretamente", () => {
    const calc = calcularDepreciacao({
      valorOriginal: 3600,
      dataCompra: "2026-01-01",
      mesesVidaUtil: 36,
      dataReferencia: new Date("2026-07-01"), // 6 meses decorridos
    });

    expect(calc.mesesDecorridos).toBe(6);
    expect(calc.mesesRestantes).toBe(30);
    expect(calc.taxaMensal).toBe(100);
    expect(calc.valorDepreciado).toBe(600);
    expect(calc.valorResidual).toBe(3000);
    expect(calc.percentualDepreciado).toBeCloseTo(16.66, 1);
    expect(calc.totalmenteDepreciado).toBe(false);
  });
});

describe("depreciação: conceito", () => {
  test("data AAAA-MM-01 conta no mês certo (sem deslocar para o mês anterior)", () => {
    const c = calcularDepreciacao({
      valorOriginal: 1200,
      dataCompra: "2026-01-01",
      mesesVidaUtil: 12,
      dataReferencia: new Date(2026, 1, 15),
    });
    expect(c.mesesDecorridos).toBe(1);
    expect(c.valorAtual).toBe(1100);
  });

  test("não passa de 100% e zera ao fim da vida útil", () => {
    const c = calcularDepreciacao({
      valorOriginal: 1000,
      dataCompra: "2020-01-10",
      mesesVidaUtil: 24,
      dataReferencia: new Date(2026, 5, 1),
    });
    expect(c.valorAtual).toBe(0);
    expect(c.totalmenteDepreciado).toBe(true);
  });

  test("óleo e filtros são manutenção e não depreciam; pneu deprecia", () => {
    expect(classificarItemNota("Oleo motor 5W30").sugestaoDepreciacao).toBeUndefined();
    expect(classificarItemNota("Pneu aro 15").sugestaoDepreciacao?.meses).toBe(36);
  });
});
