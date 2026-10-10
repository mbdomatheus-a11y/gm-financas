import { describe, expect, test } from "bun:test";

import {
  classificacaoAnterior,
  encontrarCandidatas,
  nucleoEstabelecimento,
  rotuloOrigem,
  type DespesaExistente,
  type LancamentoImportado,
} from "./duplicidade-importacao";

function despesa(p: Partial<DespesaExistente> & { id: string }): DespesaExistente {
  return {
    descricao: "Loja Exemplo",
    valor_total: 25,
    data_compra: "2026-09-10",
    direcao: "debito",
    origem: "manual",
    tipo: "variavel",
    total_parcelas: 1,
    ...p,
  };
}

const importado: LancamentoImportado = {
  id: "l1",
  descricao: "PLANO NU CEL",
  valor: 25,
  data_compra: "2026-10-10",
  parcela_numero: 1,
  parcela_total: 1,
  cartao_final: "9120",
  direcao: "debito",
};

describe("nucleoEstabelecimento", () => {
  test("ignora prefixo de adquirente, números e cidade colada", () => {
    expect(nucleoEstabelecimento("PAG*RiotGameSa")).toBe("RIOTGAMESA");
    expect(nucleoEstabelecimento("DIA BRASIL 508")).toBe("DIA BRASIL");
  });
});

describe("encontrarCandidatas", () => {
  test("acha o mesmo estabelecimento com mesmo valor em outro mês", () => {
    const r = encontrarCandidatas(importado, [
      despesa({ id: "a", descricao: "Plano Nu Cel", data_compra: "2026-09-10", tipo: "fixa" }),
      despesa({ id: "b", descricao: "Mercado do Bairro", valor_total: 25 }),
    ]);
    expect(r.map((c) => c.despesa.id)).toEqual(["a"]);
    expect(r[0]!.motivos).toContain("mesmo estabelecimento");
  });

  test("valor diferente não entra", () => {
    const r = encontrarCandidatas(importado, [despesa({ id: "a", descricao: "Plano Nu Cel", valor_total: 40 })]);
    expect(r).toHaveLength(0);
  });

  test("nome diferente só entra se for data próxima ou mesmo cartão", () => {
    const longe = encontrarCandidatas(importado, [
      despesa({ id: "a", descricao: "Outra Coisa", data_compra: "2026-05-01" }),
    ]);
    expect(longe).toHaveLength(0);
    const perto = encontrarCandidatas(importado, [
      despesa({ id: "b", descricao: "Outra Coisa", data_compra: "2026-10-09", cartao_final: "9120" }),
    ]);
    expect(perto).toHaveLength(1);
  });

  test("compara também com o valor total do parcelamento", () => {
    const parcelado = { ...importado, valor: 50, parcela_total: 3 };
    const r = encontrarCandidatas(parcelado, [
      despesa({ id: "a", descricao: "Plano Nu Cel", valor_total: 150, total_parcelas: 3 }),
    ]);
    expect(r).toHaveLength(1);
  });

  test("ordena do mais parecido para o menos", () => {
    const r = encontrarCandidatas(importado, [
      despesa({ id: "longe", descricao: "Plano Nu Cel", data_compra: "2026-01-10" }),
      despesa({ id: "perto", descricao: "Plano Nu Cel", data_compra: "2026-10-10", cartao_final: "9120" }),
    ]);
    expect(r[0]!.despesa.id).toBe("perto");
  });
});

describe("rotuloOrigem", () => {
  test("mostra de onde veio cada lançamento", () => {
    expect(rotuloOrigem(despesa({ id: "a", origem: "manual" }))).toBe("Digitado à mão");
    expect(rotuloOrigem(despesa({ id: "b", origem: "importacao" }))).toBe("Importado de fatura");
    expect(rotuloOrigem(despesa({ id: "c", origem: "manual", tipo: "fixa" }))).toBe("Despesa fixa");
    expect(rotuloOrigem(despesa({ id: "d", origem: "ia" }))).toBe("Lançado com a IA");
  });
});

describe("classificacaoAnterior", () => {
  const anteriores = [
    despesa({
      id: "a",
      descricao: "Plano Nu Cel",
      valor_total: 25,
      categoria: "Contas e assinaturas",
      tipo: "fixa",
      data_compra: "2026-09-10",
    }),
    despesa({
      id: "b",
      descricao: "Plano Nu Cel",
      valor_total: 300,
      categoria: "Outros",
      data_compra: "2026-09-20",
    }),
  ];

  test("repete categoria e tipo do mesmo estabelecimento, preferindo valor parecido", () => {
    const r = classificacaoAnterior({ descricao: "PLANO NU CEL", valor: 25 }, anteriores)!;
    expect(r.categoria).toBe("Contas e assinaturas");
    expect(r.tipo).toBe("fixa");
  });

  test("sem histórico devolve null", () => {
    expect(classificacaoAnterior({ descricao: "Loja Nova", valor: 10 }, anteriores)).toBeNull();
  });
});
