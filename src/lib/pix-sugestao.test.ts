import { describe, expect, it } from "vitest";
import { competenciaAnterior, descricaoLimpa, sugerirParaPix } from "./pix-sugestao";

describe("sugerirParaPix", () => {
  const salario15 = { id: "s15", descricao: "Salário", valor: 7500, data: "2026-09-15" };
  const salario30 = { id: "s30", descricao: "Salário", valor: 7500, data: "2026-09-30" };
  const aluguel = { id: "alu", descricao: "Aluguel recebido", valor: 1200, data: "2026-09-10" };

  it("liga o PIX de 7.952 no dia 15 ao salário do dia 15", () => {
    const pix = { id: "p1", data: "2026-09-15", valor: 7952, descricao: "PIX RECEBIDO EMPRESA X" };
    const s = sugerirParaPix(pix, [salario30, salario15, aluguel]);
    expect(s?.item.id).toBe("s15");
  });

  it("não sugere quando valor e data estão longe", () => {
    const pix = { id: "p2", data: "2026-09-02", valor: 300, descricao: "PIX RECEBIDO JOAO" };
    expect(sugerirParaPix(pix, [salario15, salario30, aluguel])).toBeNull();
  });

  it("aceita valor diferente quando o nome bate", () => {
    const pix = { id: "p3", data: "2026-09-12", valor: 1500, descricao: "PIX RECEBIDO ALUGUEL APTO" };
    expect(sugerirParaPix(pix, [salario15, aluguel])?.item.id).toBe("alu");
  });
});

describe("auxiliares", () => {
  it("competência anterior vira o ano", () => {
    expect(competenciaAnterior("2026-01")).toBe("2025-12");
  });
  it("limpa a descrição do banco", () => {
    expect(descricaoLimpa("PIX RECEBIDO - MARIA SILVA")).toBe("Maria Silva");
  });
});
