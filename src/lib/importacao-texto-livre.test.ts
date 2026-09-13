import { describe, expect, test } from "bun:test";

import { interpretarBlocoLivre, interpretarLancamentoLivre } from "./importacao-texto-livre";

const ANO_REF = 2026;

function permutacoes<T>(itens: T[]): T[][] {
  if (itens.length <= 1) return [itens];
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i++) {
    const resto = [...itens.slice(0, i), ...itens.slice(i + 1)];
    for (const p of permutacoes(resto)) resultado.push([itens[i] as T, ...p]);
  }
  return resultado;
}

describe("data em qualquer formato", () => {
  test("numérica dd/mm usa o ano de referência quando ausente", () => {
    const { lancamento } = interpretarLancamentoLivre("08/08 Loja Teste R$ 50,00", {
      anoReferencia: ANO_REF,
    });
    expect(lancamento.dataCompra).toBe("2026-08-08");
  });

  test("numérica dd/mm/aaaa respeita o ano explícito", () => {
    const { lancamento } = interpretarLancamentoLivre("08/08/2025 Loja Teste R$ 50,00", {
      anoReferencia: ANO_REF,
    });
    expect(lancamento.dataCompra).toBe("2025-08-08");
  });

  test('textual ("5 de agosto") também é reconhecida', () => {
    const { lancamento } = interpretarLancamentoLivre("5 de agosto Loja Teste R$ 50,00", {
      anoReferencia: ANO_REF,
    });
    expect(lancamento.dataCompra).toBe("2026-08-05");
  });

  test("ausente fica nula e marcada para revisão, nunca inventada", () => {
    const { lancamento, camposAusentes } = interpretarLancamentoLivre("Loja Teste R$ 50,00", {
      anoReferencia: ANO_REF,
    });
    expect(lancamento.dataCompra).toBeNull();
    expect(lancamento.confianca.data).toBe("baixa");
    expect(lancamento.exigeRevisao).toBe(true);
    expect(camposAusentes).toContain("data");
  });
});

describe("valor com sinal antes/depois e casos ambíguos", () => {
  test("sinal antes do valor", () => {
    const { lancamento } = interpretarLancamentoLivre("08/08 Estorno Loja -R$ 50,00");
    expect(lancamento.valorBruto).toContain("50,00");
    expect(lancamento.sinalOriginal).toBe("negativo_prefixo");
  });

  test("sinal depois do valor", () => {
    const { lancamento } = interpretarLancamentoLivre("08/08 Estorno Loja R$ 50,00-");
    expect(lancamento.sinalOriginal).toBe("negativo_sufixo");
  });

  test("valor entre parênteses", () => {
    const { lancamento } = interpretarLancamentoLivre("08/08 Estorno Loja (R$ 50,00)");
    expect(lancamento.sinalOriginal).toBe("parenteses");
  });

  test("número sem vírgula nem símbolo de moeda não é lido como valor (ambíguo demais)", () => {
    const { lancamento, camposAusentes } = interpretarLancamentoLivre("08/08 Assinatura mensal 50");
    expect(lancamento.valorNormalizadoCentavos).toBeNull();
    expect(lancamento.confianca.valor).toBe("baixa");
    expect(lancamento.exigeRevisao).toBe(true);
    expect(camposAusentes).toContain("valor");
  });

  test("dois valores possíveis na mesma linha ficam marcados como incertos, não adivinhados", () => {
    const { lancamento } = interpretarLancamentoLivre("08/08 Compra R$ 50,00 troco R$ 10,00");
    expect(lancamento.confianca.valor).toBe("baixa");
    expect(lancamento.exigeRevisao).toBe(true);
    // ainda preserva o primeiro valor encontrado para referência, mas sem confiança alta
    expect(lancamento.valorNormalizadoCentavos).not.toBeNull();
  });
});

describe("não confunde data com parcela ou final de cartão", () => {
  test('data sem zero à esquerda (8/9) não vira "parcela 8 de 9"', () => {
    const { lancamento } = interpretarLancamentoLivre("Compra em 8/9 R$ 50,00", {
      anoReferencia: ANO_REF,
    });
    expect(lancamento.dataCompra).toBe("2026-09-08");
    expect(lancamento.parcelaAtual).toBeNull();
    expect(lancamento.parcelaTotal).toBeNull();
  });

  test("parcela e cartão são lidos corretamente quando presentes", () => {
    const { lancamento } = interpretarLancamentoLivre(
      "08/08 Loja Teste R$ 122,08 parc 2/3 final 5360",
      {
        anoReferencia: ANO_REF,
      },
    );
    expect(lancamento.parcelaAtual).toBe(2);
    expect(lancamento.parcelaTotal).toBe(3);
    expect(lancamento.cartaoFinal).toBe("5360");
  });
});

describe("independência de ordem (permutação dos mesmos dados)", () => {
  const campos = ["08/08", "Loja Teste", "R$ 122,08", "parc 2/3", "final 5360"];

  test.each(permutacoes(campos).map((p) => [p.join(" ")] as const))("%s", (linha) => {
    const { lancamento } = interpretarLancamentoLivre(linha, { anoReferencia: ANO_REF });
    expect(lancamento.dataCompra).toBe("2026-08-08");
    expect(lancamento.valorNormalizadoCentavos).not.toBeNull();
    expect(Math.abs(lancamento.valorNormalizadoCentavos ?? 0)).toBe(12208);
    expect(lancamento.parcelaAtual).toBe(2);
    expect(lancamento.parcelaTotal).toBe(3);
    expect(lancamento.cartaoFinal).toBe("5360");
    expect(lancamento.exigeRevisao).toBe(false);
    expect(lancamento.descricaoNormalizada.toLowerCase()).toContain("loja");
  });
});

describe("delimitadores comuns (vírgula e ponto e vírgula)", () => {
  test("vírgulas e ponto e vírgula entre campos não atrapalham a leitura", () => {
    const { lancamento } = interpretarLancamentoLivre("08/08; Loja Teste, R$ 122,08; parc 2/3", {
      anoReferencia: ANO_REF,
    });
    expect(lancamento.dataCompra).toBe("2026-08-08");
    expect(Math.abs(lancamento.valorNormalizadoCentavos ?? 0)).toBe(12208);
    expect(lancamento.parcelaAtual).toBe(2);
  });
});

describe("interpretarBlocoLivre", () => {
  test("um lançamento por linha, ignorando linhas vazias", () => {
    const bloco = [
      "08/08 Loja A R$ 10,00",
      "",
      "09/08 Loja B R$ 20,00",
      "   ",
      "10/08 Loja C R$ 30,00",
    ].join("\n");
    const resultados = interpretarBlocoLivre(bloco, { anoReferencia: ANO_REF });
    expect(resultados).toHaveLength(3);
    expect(resultados.map((r) => r.lancamento.dataCompra)).toEqual([
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
    ]);
  });
});
