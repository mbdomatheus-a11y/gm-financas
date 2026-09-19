import { describe, expect, it } from "bun:test";
import { encontrarCorrespondenciaFixa, type FixaCandidata, type LancamentoCandidato } from "./correspondencia-fixa";

const fixa: FixaCandidata = {
  id: "fixa-1", descricao: "Pedágio Via", valor_total: 150, tipo: "fixa", direcao: "debito",
  cartao_id: "cartao-1", cartao_final: "1234", banco_id: null,
  recorrencia_inicio: "2026-01-01", recorrencia_meses: null,
  data_primeira_parcela: "2026-01-01", total_parcelas: 1,
};
const lancamento: LancamentoCandidato = {
  descricao: "Pedágio Via", valor: 150, direcao: "debito", data_compra: "2026-09-10",
  parcela_total: 1, cartao_final: "1234", cartao_id: "cartao-1", banco_id: null,
  competencia: "2026-09",
};

describe("correspondência com despesa fixa", () => {
  it("sinaliza descrição, valor, cartão e competência iguais sem afirmar duplicidade", () => {
    expect(encontrarCorrespondenciaFixa([fixa], lancamento)?.titulo).toBe("Possível correspondência");
  });
  it("aceita pequena variação de valor somente com os demais campos compatíveis", () => {
    expect(encontrarCorrespondenciaFixa([fixa], { ...lancamento, valor: 151 })).not.toBeNull();
    expect(encontrarCorrespondenciaFixa([fixa], { ...lancamento, valor: 115.84 })).toBeNull();
  });
  it("não confunde Anthropic, outro pedágio ou mesma categoria com a fixa", () => {
    expect(encontrarCorrespondenciaFixa([fixa], { ...lancamento, descricao: "Anthropic", valor: 113.94 })).toBeNull();
    expect(encontrarCorrespondenciaFixa([fixa], { ...lancamento, descricao: "Pedágio Outra Via" })).toBeNull();
  });
  it("não compara cartão diferente nem período anterior", () => {
    expect(encontrarCorrespondenciaFixa([fixa], { ...lancamento, cartao_final: "9999", cartao_id: "outro" })).toBeNull();
    expect(encontrarCorrespondenciaFixa([fixa], { ...lancamento, competencia: "2025-12" })).toBeNull();
  });
  it("não compara lançamentos parcelados", () => {
    expect(encontrarCorrespondenciaFixa([fixa], { ...lancamento, parcela_total: 3 })).toBeNull();
  });
});
