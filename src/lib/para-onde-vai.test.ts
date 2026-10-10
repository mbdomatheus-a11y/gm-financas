import { describe, expect, test } from "bun:test";

import {
  detectarRecorrentes,
  gerarPerguntas,
  quadrosPorMes,
  recorrentesAtivos,
  recorrentesEncerrados,
  resumirPorCategoria,
  type GastoMes,
} from "./para-onde-vai";

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function g(
  competencia: string,
  categoria: string,
  descricao: string,
  valor: number,
  extra: Partial<GastoMes> = {},
): GastoMes {
  return {
    competencia,
    categoria,
    descricao,
    chave: descricao.toUpperCase(),
    valor,
    despesaId: `${descricao}-${competencia}`,
    ...extra,
  };
}

const meses = ["2026-07", "2026-08", "2026-09", "2026-10"];
const gastos: GastoMes[] = [
  ...meses.map((m) => g(m, "Assinaturas", "Plano Nu Cel", 25)),
  ...meses.slice(0, 2).map((m) => g(m, "Assinaturas", "Streaming XPTO", 40)),
  ...meses.map((m) => g(m, "Pet", "Racao do Thor", 120)),
  g("2026-10", "Alimentação", "Mercado", 900),
  g("2026-09", "Alimentação", "Mercado", 400),
  g("2026-10", "Casa", "Sofa novo", 300, { parcelado: true }),
];

describe("resumirPorCategoria", () => {
  const r = resumirPorCategoria(gastos, "2026-10");

  test("ordena da maior para a menor e calcula participação", () => {
    expect(r[0]!.categoria).toBe("Alimentação");
    const soma = r.reduce((s, x) => s + x.participacao, 0);
    expect(Math.round(soma)).toBe(100);
  });

  test("compara o mês atual com a média dos meses anteriores", () => {
    const alimentacao = r.find((x) => x.categoria === "Alimentação")!;
    expect(alimentacao.mesAtual).toBe(900);
    expect(alimentacao.mediaAnterior).toBe(400);
    expect(alimentacao.variacao).toBe(125);
  });

  test("sem base de comparação a variação fica vazia", () => {
    const casa = r.find((x) => x.categoria === "Casa")!;
    expect(casa.variacao).toBeNull();
  });
});

describe("detectarRecorrentes", () => {
  const rec = detectarRecorrentes(gastos, "2026-10");

  test("reconhece a cobrança que se repete todo mês", () => {
    const plano = rec.find((x) => x.descricao === "Plano Nu Cel")!;
    expect(plano.valor).toBe(25);
    expect(plano.competencias).toHaveLength(4);
    expect(plano.mesesSemAparecer).toBe(0);
  });

  test("ignora parcelamento e gasto de poucos meses", () => {
    expect(rec.find((x) => x.descricao === "Sofa novo")).toBeUndefined();
    expect(rec.find((x) => x.descricao === "Streaming XPTO")).toBeUndefined();
  });

  test("ignora compras avulsas no mesmo lugar com valores muito diferentes", () => {
    const variados = ["2026-07", "2026-08", "2026-09", "2026-10"].map((m, i) =>
      g(m, "Alimentação", "Posto", [30, 250, 80, 400][i]!),
    );
    expect(detectarRecorrentes(variados, "2026-10")).toHaveLength(0);
  });
});

describe("economia gerada quando a cobrança some", () => {
  const comSumico: GastoMes[] = [
    ...["2026-04", "2026-05", "2026-06"].map((m) => g(m, "Assinaturas", "Streaming XPTO", 40)),
    ...meses.map((m) => g(m, "Assinaturas", "Plano Nu Cel", 25)),
  ];
  const rec = detectarRecorrentes(comSumico, "2026-10");

  test("conta os meses sem aparecer e acumula a economia", () => {
    const sumido = recorrentesEncerrados(rec);
    expect(sumido).toHaveLength(1);
    expect(sumido[0]!.descricao).toBe("Streaming XPTO");
    expect(sumido[0]!.mesesSemAparecer).toBe(4);
    expect(sumido[0]!.economiaAcumulada).toBe(160);
  });

  test("o que ainda aparece continua ativo", () => {
    expect(recorrentesAtivos(rec).map((x) => x.descricao)).toEqual(["Plano Nu Cel"]);
  });
});

describe("quadrosPorMes", () => {
  test("mostra o total e onde pesou mais em cada mês", () => {
    const q = quadrosPorMes(gastos, ["2026-09", "2026-10"]);
    expect(q[0]!.maiorCategoria).toBe("Alimentação");
    expect(q[1]!.total).toBe(1345);
    expect(q[1]!.maiorPercentual).toBeGreaterThan(60);
  });
});

describe("gerarPerguntas", () => {
  const resumo = resumirPorCategoria(gastos, "2026-10");
  const rec = detectarRecorrentes(gastos, "2026-10");
  const p = gerarPerguntas(resumo, rec, 3000, fmt);

  test("fala da maior categoria e do que subiu", () => {
    expect(p.find((x) => x.id === "maior-categoria")).toBeTruthy();
    expect(p.find((x) => x.id === "subiu")!.texto).toContain("Alimentação");
  });

  test("resume as cobranças que se repetem", () => {
    expect(p.find((x) => x.id === "assinaturas")!.texto).toContain("2 cobrança(s)");
  });

  test("sem dados não inventa pergunta", () => {
    expect(gerarPerguntas([], [], 0, fmt)).toHaveLength(0);
  });
});
