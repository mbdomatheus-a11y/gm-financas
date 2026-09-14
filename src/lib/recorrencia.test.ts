import { describe, expect, test } from "bun:test";
import {
  aplicacoesDeReajuste,
  recorrenciaDaReceita,
  somarMeses,
  valorNaCompetencia,
  type RecorrenciaFixa,
} from "@/lib/recorrencia";

describe("valorNaCompetencia — reajuste percentual (compatibilidade com despesas)", () => {
  const base: RecorrenciaFixa = {
    valor: 1000,
    inicio: "2026-01-15",
    semPrazo: true,
    reajuste: { percentual: 10, periodicidade: "anual" },
  };

  test("mantém o valor antes do 1º reajuste", () => {
    expect(valorNaCompetencia(base, "2026-06")).toBe(1000);
  });

  test("aplica reajuste composto a cada período (sem modo = percentual)", () => {
    expect(valorNaCompetencia(base, "2027-01")).toBe(1100);
    expect(valorNaCompetencia(base, "2028-01")).toBe(1210);
  });

  test("fora do período antes do início retorna null", () => {
    expect(valorNaCompetencia(base, "2025-12")).toBeNull();
  });
});

describe("valorNaCompetencia — reajuste em valor fixo (novo, usado em receitas)", () => {
  const salario: RecorrenciaFixa = {
    valor: 5000,
    inicio: "2026-09-01",
    semPrazo: true,
    reajuste: { modo: "fixo", percentual: 0, valorFixo: 400, periodicidade: "anual" },
  };

  test("mantém o valor antes do 1º reajuste", () => {
    expect(valorNaCompetencia(salario, "2027-08")).toBe(5000);
  });

  test("soma o valor fixo (não compõe) a cada reajuste anual", () => {
    expect(valorNaCompetencia(salario, "2027-09")).toBe(5400);
    expect(valorNaCompetencia(salario, "2028-09")).toBe(5800);
    expect(valorNaCompetencia(salario, "2029-09")).toBe(6200);
  });

  test("reajuste fixo de zero não tem efeito", () => {
    const semEfeito: RecorrenciaFixa = {
      ...salario,
      reajuste: { modo: "fixo", percentual: 0, valorFixo: 0, periodicidade: "anual" },
    };
    expect(valorNaCompetencia(semEfeito, "2030-09")).toBe(5000);
  });

  test("aplicacoesDeReajuste conta as aplicações do modo fixo normalmente", () => {
    expect(aplicacoesDeReajuste(salario, "2026-12")).toBe(0);
    expect(aplicacoesDeReajuste(salario, "2027-09")).toBe(1);
    expect(aplicacoesDeReajuste(salario, "2028-09")).toBe(2);
  });
});

describe("recorrenciaDaReceita", () => {
  test("lê receita mensal sem prazo com reajuste percentual", () => {
    const r = recorrenciaDaReceita({
      valor: 4000,
      data_recebimento: "2026-09-05",
      recorrencia_inicio: "2026-09-05",
      recorrencia_sem_prazo: true,
      reajuste_modo: "percentual",
      reajuste_percentual: 4,
      reajuste_periodicidade: "anual",
    });
    expect(r).not.toBeNull();
    expect(r?.semPrazo).toBe(true);
    expect(r?.reajuste?.modo).toBe("percentual");
    expect(valorNaCompetencia(r!, somarMeses("2026-09", 12))).toBe(4160);
  });

  test("lê receita mensal sem prazo com reajuste fixo", () => {
    const r = recorrenciaDaReceita({
      valor: 4000,
      data_recebimento: "2026-09-05",
      recorrencia_inicio: "2026-09-05",
      recorrencia_sem_prazo: true,
      reajuste_modo: "fixo",
      reajuste_valor_fixo: 400,
      reajuste_periodicidade: "anual",
    });
    expect(r?.reajuste?.modo).toBe("fixo");
    expect(valorNaCompetencia(r!, somarMeses("2026-09", 12))).toBe(4400);
  });

  test("receita sem recorrencia_inicio e sem data_recebimento retorna null", () => {
    expect(recorrenciaDaReceita({ valor: 100 })).toBeNull();
  });

  test("receita legada (sem colunas novas) não tem reajuste ativo", () => {
    const r = recorrenciaDaReceita({ valor: 100, data_recebimento: "2026-01-10" });
    expect(r?.reajuste).toBeNull();
  });
});
