import { describe, expect, test } from "bun:test";

import { identificarParcela } from "./parcela";

describe("identificarParcela — formatos reais confirmados em faturas", () => {
  test.each([
    // Pernambucanas/Elo — "PARC.N/M" sem espaço, colado no nome da loja.
    ["PERNAMBUCANAS 377 PARC.9/10", { atual: 9, total: 10 }],
    ["PORTO SEGURO PARC.8/12", { atual: 8, total: 12 }],
    ["PERNAMBUCANAS 377 PARC.4/4", { atual: 4, total: 4 }],
    // Itaú — fração nua COM ZERO À ESQUERDA, sem nenhuma palavra-chave.
    ["PAG*RiotGameSa 02/03", { atual: 2, total: 3 }],
    ["BENIPETSAO PAU 01/02", { atual: 1, total: 2 }],
    ["TikTok Shop *M 01/03", { atual: 1, total: 3 }],
    ["NUV*MAISONVIEG 01/04", { atual: 1, total: 4 }],
    // Nubank — "Nome - Parcela N/M".
    ["Petz - Parcela 2/3", { atual: 2, total: 3 }],
    ["Porto Seguro Cia Seg G - Parcela 10/12", { atual: 10, total: 12 }],
    ["Amazonmktplc*Hannoverh - Parcela 6/6", { atual: 6, total: 6 }],
    // Outras formas já suportadas anteriormente.
    ["Petz PARC. 01 DE 03", { atual: 1, total: 3 }],
    ["Petz 01 D 03", { atual: 1, total: 3 }],
    ["Compra parcelada 2ª de 5", { atual: 2, total: 5 }],
  ] as const)("reconhece parcela em %s", (texto, esperado) => {
    expect(identificarParcela(texto)).toEqual(esperado);
  });

  test("não reconhece quando não há parcela", () => {
    expect(identificarParcela("PADARIA DO BAIRRO")).toBeNull();
  });

  test("rejeita totais fora do intervalo plausível (1-99)", () => {
    expect(identificarParcela("Compra 5/150")).toBeNull();
  });

  test("rejeita quando atual > total", () => {
    expect(identificarParcela("Compra 9/3")).toBeNull();
  });

  test("rejeita total = 1 (não é parcelamento, é compra única)", () => {
    expect(identificarParcela("Compra 1/1")).toBeNull();
  });

  test("cidade/país junto na descrição não atrapalha (caso real Pernambucanas)", () => {
    // A descrição pode vir suja com cidade/país e um dígito solto do layout do PDF.
    expect(identificarParcela("PERNAMBUCANAS 18 PARC.4/10 SAO PAULO/Brasil")).toEqual({
      atual: 4,
      total: 10,
    });
  });
});
