import { describe, expect, test } from "bun:test";
import {
  projetarRendimento,
  taxaAnualParaMensal,
  taxaMensalEfetiva,
  type ConfigRendimento,
} from "@/lib/rendimento";

describe("taxaAnualParaMensal", () => {
  test("10% a.a. equivale a ~0,797% a.m.", () => {
    expect(taxaAnualParaMensal(10)).toBeCloseTo(0.797414, 4);
  });

  test("0% a.a. equivale a 0% a.m.", () => {
    expect(taxaAnualParaMensal(0)).toBe(0);
  });
});

describe("taxaMensalEfetiva", () => {
  test("CDI a 110% aplica o percentual sobre a taxa-base anual", () => {
    const cfg: ConfigRendimento = { tipo: "cdi", percentual: 110 };
    // base 10% a.a. -> efetiva 11% a.a.
    expect(taxaMensalEfetiva(cfg, 10)).toBeCloseTo(taxaAnualParaMensal(11), 6);
  });

  test("Selic a 90% aplica o percentual sobre a taxa-base anual", () => {
    const cfg: ConfigRendimento = { tipo: "selic", percentual: 90 };
    expect(taxaMensalEfetiva(cfg, 10)).toBeCloseTo(taxaAnualParaMensal(9), 6);
  });

  test("IPCA+ compõe o spread sobre o IPCA base", () => {
    const cfg: ConfigRendimento = { tipo: "ipca_mais", percentual: 5 };
    // base 4% a.a. IPCA -> (1.04 * 1.05 - 1) * 100 = 9.2% a.a.
    expect(taxaMensalEfetiva(cfg, 4)).toBeCloseTo(taxaAnualParaMensal(9.2), 6);
  });

  test("taxa fixa ignora a taxa-base", () => {
    const cfg: ConfigRendimento = { tipo: "fixo", percentual: 8 };
    expect(taxaMensalEfetiva(cfg, null)).toBeCloseTo(taxaAnualParaMensal(8), 6);
    expect(taxaMensalEfetiva(cfg, 999)).toBeCloseTo(taxaAnualParaMensal(8), 6);
  });

  test("CDI/Selic sem taxa-base disponível rende zero", () => {
    const cfg: ConfigRendimento = { tipo: "cdi", percentual: 110 };
    expect(taxaMensalEfetiva(cfg, null)).toBe(0);
  });
});

describe("projetarRendimento", () => {
  test("projeta 12 meses de taxa fixa compondo sobre o valor atual", () => {
    const cfg: ConfigRendimento = { tipo: "fixo", percentual: 12 };
    const projecao = projetarRendimento(1000, cfg, null, 12);
    expect(projecao).toHaveLength(12);
    expect(projecao[0]!.mes).toBe(1);
    expect(projecao[11]!.mes).toBe(12);
    // 12% a.a. composto por 12 meses deve aproximar o valor final de 1120.
    expect(projecao[11]!.valor).toBeCloseTo(1120, 0);
    // Estritamente crescente mês a mês.
    for (let i = 1; i < projecao.length; i++) {
      expect(projecao[i]!.valor).toBeGreaterThan(projecao[i - 1]!.valor);
    }
  });

  test("taxa zero mantém o valor constante", () => {
    const cfg: ConfigRendimento = { tipo: "fixo", percentual: 0 };
    const projecao = projetarRendimento(500, cfg, null, 6);
    for (const p of projecao) expect(p.valor).toBe(500);
  });
});
