import { expect, test } from "bun:test";
import { macroDe, montarEstrutura, separarNomeLegado, subDe } from "@/lib/macro-categorias";

const macros = new Set(["Pets", "Moradia / Casa", "Alimentação"]);

test("separa nome legado Macro - Sub", () => {
  expect(separarNomeLegado("Pets - Veterinário")).toEqual({ macro: "Pets", sub: "Veterinário" });
  expect(separarNomeLegado("Mercado")).toEqual({ macro: "Mercado", sub: null });
});

test("agrupa nomes legados pela macro conhecida", () => {
  expect(macroDe("Pets - Veterinário", macros)).toBe("Pets");
  expect(macroDe("Moradia / Casa", macros)).toBe("Moradia / Casa");
  expect(macroDe("Alimentação - Açaí / Lanche", macros)).toBe("Alimentação");
  expect(macroDe("Viagens", macros)).toBe("Viagens");
  expect(macroDe(null, macros)).toBe("Outros");
});

test("devolve a subcategoria do nome legado", () => {
  expect(subDe("Pets - Veterinário", "Pets")).toBe("Veterinário");
  expect(subDe("Pets - Veterinário", "Mercado")).toBeNull();
});

test("monta a estrutura juntando padrão, categorias antigas e subcategorias", () => {
  const est = montarEstrutura({
    padrao: [{ nome: "Pets", subcategorias: ["Pet shop"] }],
    categorias: [{ nome: "Pets - Veterinário" }, { nome: "Lazer" }],
    subcategorias: [{ categoria: "Pets", nome: "Banho e tosa" }],
  });
  expect(est.find((e) => e.macro === "Pets")?.subcategorias).toEqual([
    "Banho e tosa",
    "Pet shop",
    "Veterinário",
  ]);
  expect(est.map((e) => e.macro)).toContain("Lazer");
});
