import { describe, expect, it } from "bun:test";
import { CATEGORIAS_PADRAO } from "./categorizacao";

describe("De-Para: macrocategorias do sistema", () => {
  it("deve conter exatamente as macrocategorias padrao esperadas", () => {
    expect(CATEGORIAS_PADRAO["Alimentação"]).toBeDefined();
    expect(CATEGORIAS_PADRAO["Mercado"]).toBeDefined();
    expect(CATEGORIAS_PADRAO["Veículo"]).toBeDefined();
    expect(CATEGORIAS_PADRAO["Saúde"]).toBeDefined();
    expect(CATEGORIAS_PADRAO["Transporte"]).toBeDefined();
  });

  it("subcategorias devem pertencer a sua respectiva macrocategoria", () => {
    expect(CATEGORIAS_PADRAO["Alimentação"]).toContain("Restaurante");
    expect(CATEGORIAS_PADRAO["Veículo"]).toContain("Combustível");
    expect(CATEGORIAS_PADRAO["Mercado"]).toContain("Supermercado");
    expect(CATEGORIAS_PADRAO["Saúde"]).toContain("Farmácia");
  });
});
