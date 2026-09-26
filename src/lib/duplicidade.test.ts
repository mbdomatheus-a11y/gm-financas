import { describe, expect, it } from "vitest";
import { verificarPossivelDuplicata } from "./duplicidade";

describe("verificarPossivelDuplicata", () => {
  it("detecta duplicidade quando valor é igual e há termo em comum na descrição", () => {
    const item = { id: "1", descricao: "Uber *TRIP HELP.US", valor: 54.94 };
    const existentes = [
      { id: "2", descricao: "Uber UBER *TRIP HELP.US", valor: 54.94 },
    ];
    const res = verificarPossivelDuplicata(item, existentes);
    expect(res.duplicata).toBe(true);
    expect(res.motivo).toContain("uber");
  });

  it("não sinaliza se o valor for diferente", () => {
    const item = { id: "1", descricao: "Uber *TRIP HELP.US", valor: 54.94 };
    const existentes = [
      { id: "2", descricao: "Uber UBER *TRIP HELP.US", valor: 18.94 },
    ];
    const res = verificarPossivelDuplicata(item, existentes);
    expect(res.duplicata).toBe(false);
  });

  it("não sinaliza se não houver termos em comum na descrição", () => {
    const item = { id: "1", descricao: "Farmacia Drogaria SP", valor: 50.0 };
    const existentes = [
      { id: "2", descricao: "Restaurante Outback", valor: 50.0 },
    ];
    const res = verificarPossivelDuplicata(item, existentes);
    expect(res.duplicata).toBe(false);
  });
});
