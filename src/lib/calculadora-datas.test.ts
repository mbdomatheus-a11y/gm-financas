import { describe, expect, test } from "bun:test";

import {
  diferencaEntreDatas,
  somarHorarios,
  somarIntervaloData,
  type TermoHorario,
} from "./calculadora-datas";

describe("diferencaEntreDatas", () => {
  test("conta dias corretamente, inclusive em ano bissexto", () => {
    expect(diferencaEntreDatas("2018-01-01", "2018-12-31", "dias")).toBe(364);
  });

  test("não depende da ordem das datas (sempre positivo)", () => {
    expect(diferencaEntreDatas("2026-01-01", "2026-01-10", "dias")).toBe(9);
    expect(diferencaEntreDatas("2026-01-10", "2026-01-01", "dias")).toBe(9);
  });

  test("converte para horas e minutos", () => {
    expect(diferencaEntreDatas("2026-01-01", "2026-01-02", "horas")).toBe(24);
    expect(diferencaEntreDatas("2026-01-01", "2026-01-02", "minutos")).toBe(1440);
  });

  test("mesma data dá zero em qualquer unidade", () => {
    expect(diferencaEntreDatas("2026-05-05", "2026-05-05", "dias")).toBe(0);
    expect(diferencaEntreDatas("2026-05-05", "2026-05-05", "horas")).toBe(0);
  });
});

describe("somarIntervaloData", () => {
  test("soma dias", () => {
    expect(somarIntervaloData("2028-01-01", 30, "dias")).toBe("2028-01-31");
  });

  test("subtrai dias com quantidade negativa", () => {
    expect(somarIntervaloData("2028-01-31", -30, "dias")).toBe("2028-01-01");
  });

  test("soma meses e anos", () => {
    expect(somarIntervaloData("2026-01-15", 2, "meses")).toBe("2026-03-15");
    expect(somarIntervaloData("2026-01-15", 1, "anos")).toBe("2027-01-15");
  });
});

describe("somarHorarios", () => {
  test("soma e subtrai durações HH:MM", () => {
    // 08:00 + 7:20 - 1:15 = 14:05
    const termos: TermoHorario[] = [
      { sinal: 1, horas: 8, minutos: 0 },
      { sinal: 1, horas: 7, minutos: 20 },
      { sinal: -1, horas: 1, minutos: 15 },
    ];
    expect(somarHorarios(termos)).toEqual({ negativo: false, horas: 14, minutos: 5 });
  });

  test("resultado negativo fica marcado, com horas/minutos em valor absoluto", () => {
    const termos: TermoHorario[] = [
      { sinal: 1, horas: 1, minutos: 0 },
      { sinal: -1, horas: 3, minutos: 30 },
    ];
    expect(somarHorarios(termos)).toEqual({ negativo: true, horas: 2, minutos: 30 });
  });

  test("lista vazia dá zero", () => {
    expect(somarHorarios([])).toEqual({ negativo: false, horas: 0, minutos: 0 });
  });
});
