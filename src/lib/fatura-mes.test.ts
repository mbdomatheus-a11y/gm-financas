import { describe, expect, test } from "vitest";
import { aplicarRegrasFaturaMes } from "./fatura-mes";

const itens = [
  { despesa_id: "resumo", vencimento: "2026-09-10", despesa: { cartao_id: "c1" } },
  { despesa_id: "detalhe", vencimento: "2026-09-12", despesa: { cartao_id: "c1" } },
  { despesa_id: "outro", vencimento: "2026-09-12", despesa: { cartao_id: "c2" } },
];

describe("aplicarRegrasFaturaMes", () => {
  test("mantém apenas o total manual enquanto a fatura está aberta", () => {
    expect(
      aplicarRegrasFaturaMes(itens, [
        {
          cartao_id: "c1",
          competencia: "2026-09",
          modo_calculo: "somente_total",
          status: "aberta",
          despesa_avulsa_id: "resumo",
        },
      ]).map((x) => x.despesa_id),
    ).toEqual(["resumo", "outro"]);
  });
  test("mantém os detalhes e retira o resumo depois da importação", () => {
    expect(
      aplicarRegrasFaturaMes(itens, [
        {
          cartao_id: "c1",
          competencia: "2026-09",
          modo_calculo: "somente_total",
          status: "fechada",
          despesa_avulsa_id: "resumo",
        },
      ]).map((x) => x.despesa_id),
    ).toEqual(["detalhe", "outro"]);
  });
});
