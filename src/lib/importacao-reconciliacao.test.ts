import { describe, expect, test } from "bun:test";

import { ehLinhaResumoFatura, extrairMetadadosFatura } from "./fatura-metadados";
import { FATURAS_ANONIMIZADAS } from "./importacao-fixtures";
import {
  classificarTipoSemantico,
  lerValorMonetario,
  normalizarCentavosPorTipo,
  type LancamentoImportadoCompleto,
  type TipoLancamentoImportado,
} from "./importacao-modelo";
import {
  agruparPorSecao,
  categoriaFinanceira,
  conferirFatura,
  conferirSecoes,
  resumirLancamentos,
  TOLERANCIA_CONFERENCIA_CENTAVOS,
} from "./importacao-reconciliacao";

/** Monta um lançamento completo de teste com o mínimo de repetição. */
function lancamento(opts: {
  tipo: TipoLancamentoImportado;
  centavos: number;
  secao?: string | null;
  exigeRevisao?: boolean;
}): LancamentoImportadoCompleto {
  return {
    id: crypto.randomUUID(),
    dataCompra: "2026-08-08",
    descricaoOriginal: "Lançamento teste",
    descricaoNormalizada: "lancamento teste",
    tipo: opts.tipo,
    valorBruto: String(opts.centavos),
    valorNormalizadoCentavos: normalizarCentavosPorTipo(Math.abs(opts.centavos), opts.tipo),
    moeda: "BRL",
    sinalOriginal: "positivo",
    parcelaAtual: null,
    parcelaTotal: null,
    cartaoFinal: null,
    titular: null,
    evidencia: { pagina: null, trecho: "", secao: opts.secao ?? null },
    confianca: {
      data: "alta",
      descricao: "alta",
      valor: "alta",
      tipo: "alta",
      parcela: "alta",
      cartao: "alta",
    },
    exigeRevisao: opts.exigeRevisao ?? false,
  };
}

describe("categoriaFinanceira", () => {
  test.each([
    ["pagamento", "pagamento"],
    ["estorno", "estorno"],
    ["outro_credito", "credito"],
    ["compra", "despesa"],
    ["tarifa", "despesa"],
    ["juros", "despesa"],
    ["multa", "despesa"],
    ["imposto", "despesa"],
    ["seguro", "despesa"],
    ["saque", "despesa"],
    ["indefinido", "despesa"],
  ] as const)("%s → %s", (tipo, esperado) => {
    expect(categoriaFinanceira(tipo)).toBe(esperado);
  });
});

describe("resumirLancamentos", () => {
  test("separa despesa, pagamento, estorno e crédito sem confundir sinais", () => {
    const lancamentos = [
      lancamento({ tipo: "compra", centavos: 12208 }),
      lancamento({ tipo: "pagamento", centavos: 50000 }),
      lancamento({ tipo: "estorno", centavos: 2500 }),
      lancamento({ tipo: "outro_credito", centavos: 1000 }),
    ];
    const resumo = resumirLancamentos(lancamentos, 2);
    expect(resumo).toEqual({
      encontrados: 4,
      duvidosos: 0,
      ignorados: 2,
      despesasCentavos: 12208,
      pagamentosCentavos: 50000,
      estornosCentavos: 2500,
      creditosCentavos: 1000,
      saldoCentavos: -12208 + 50000 + 2500 + 1000,
    });
  });

  test("conta duvidosos sem excluí-los da soma", () => {
    const lancamentos = [
      lancamento({ tipo: "compra", centavos: 1000, exigeRevisao: true }),
      lancamento({ tipo: "compra", centavos: 2000 }),
    ];
    const resumo = resumirLancamentos(lancamentos);
    expect(resumo.duvidosos).toBe(1);
    expect(resumo.encontrados).toBe(2);
    expect(resumo.despesasCentavos).toBe(3000);
    expect(resumo.ignorados).toBe(0);
  });

  test("lista vazia não gera NaN nem divide por zero", () => {
    expect(resumirLancamentos([])).toEqual({
      encontrados: 0,
      duvidosos: 0,
      ignorados: 0,
      despesasCentavos: 0,
      pagamentosCentavos: 0,
      estornosCentavos: 0,
      creditosCentavos: 0,
      saldoCentavos: 0,
    });
  });
});

describe("conferirFatura", () => {
  test("confere quando a diferença está dentro de 1 centavo", () => {
    const resultado = conferirFatura(-70565, 70565);
    expect(resultado.diferencaCentavos).toBe(0);
    expect(resultado.confere).toBe(true);
  });

  test("tolera exatamente a borda de R$ 0,01", () => {
    expect(conferirFatura(-70565, 70565 + TOLERANCIA_CONFERENCIA_CENTAVOS).confere).toBe(true);
    expect(conferirFatura(-70565, 70565 + TOLERANCIA_CONFERENCIA_CENTAVOS + 1).confere).toBe(false);
  });

  test("sem total declarado, a divergência fica explícita em vez de presumir sucesso", () => {
    const resultado = conferirFatura(37792, null);
    expect(resultado.totalDeclaradoCentavos).toBeNull();
    expect(resultado.diferencaCentavos).toBeNull();
    expect(resultado.confere).toBe(false);
  });
});

describe("agruparPorSecao e conferirSecoes", () => {
  test("agrupa por seção preservando itens sem seção conhecida", () => {
    const a = lancamento({ tipo: "compra", centavos: 1000, secao: "COMPRAS" });
    const b = lancamento({ tipo: "compra", centavos: 2000, secao: "COMPRAS" });
    const c = lancamento({ tipo: "pagamento", centavos: 3000, secao: null });
    const grupos = agruparPorSecao([a, b, c]);
    expect(grupos).toEqual([
      { secao: "COMPRAS", itens: [a, b] },
      { secao: null, itens: [c] },
    ]);
  });

  test("confere automaticamente só quando há uma seção e um subtotal (pareamento inequívoco)", () => {
    const item = lancamento({ tipo: "compra", centavos: 20542, secao: "Cartão único" });
    const [resultado] = conferirSecoes(agruparPorSecao([item]), [20542]);
    expect(resultado).toEqual({
      secao: "Cartão único",
      somaCentavos: 20542,
      subtotalDeclaradoCentavos: 20542,
      diferencaCentavos: 0,
      confere: true,
    });
  });

  test("não arrisca pareamento errado com múltiplas seções ou múltiplos subtotais", () => {
    const a = lancamento({ tipo: "compra", centavos: 1000, secao: "Cartão A" });
    const b = lancamento({ tipo: "compra", centavos: 2000, secao: "Cartão B" });
    const resultados = conferirSecoes(agruparPorSecao([a, b]), [1000, 2000]);
    for (const r of resultados) {
      expect(r.subtotalDeclaradoCentavos).toBeNull();
      expect(r.diferencaCentavos).toBeNull();
      expect(r.confere).toBe(false);
    }
  });
});

describe("ponta a ponta com as amostras anonimizadas", () => {
  function construirLancamentos(linhas: readonly string[]) {
    const lancamentos: LancamentoImportadoCompleto[] = [];
    let secaoAtual: string | null = null;
    let ignoradas = 0;
    for (const linha of linhas) {
      const isSecao =
        linha === linha.toUpperCase() && !/\d/.test(linha) && !/R\$|\d,\d/.test(linha);
      if (isSecao) {
        secaoAtual = linha;
        continue;
      }
      if (ehLinhaResumoFatura(linha)) {
        ignoradas += 1;
        continue;
      }
      const valorMatch = linha.match(/[+-]?R?\$?\s*[\d.]+,\d{2}[+-]?/);
      if (!valorMatch) continue;
      const lido = lerValorMonetario(valorMatch[0]);
      if (!lido) continue;
      const tipo = classificarTipoSemantico(linha, secaoAtual);
      lancamentos.push(lancamento({ tipo, centavos: lido.centavosAbsolutos, secao: secaoAtual }));
    }
    return { lancamentos, ignoradas };
  }

  test("desconhecido: despesa única confere exatamente com o total declarado", () => {
    const texto = FATURAS_ANONIMIZADAS.desconhecido.join("\n");
    const { lancamentos, ignoradas } = construirLancamentos(FATURAS_ANONIMIZADAS.desconhecido);
    const resumo = resumirLancamentos(lancamentos, ignoradas);
    const metadados = extrairMetadadosFatura(texto);

    expect(resumo.encontrados).toBe(1);
    expect(resumo.despesasCentavos).toBe(2990);
    expect(metadados.totalFaturaCentavos).toBe(2990);

    const conferencia = conferirFatura(resumo.saldoCentavos, metadados.totalFaturaCentavos);
    expect(conferencia.confere).toBe(true);
  });

  test("itaú: pagamento recebido não vira despesa e o resumo de próximas faturas é ignorado", () => {
    const { lancamentos, ignoradas } = construirLancamentos(FATURAS_ANONIMIZADAS.itau);
    const resumo = resumirLancamentos(lancamentos, ignoradas);

    expect(resumo.encontrados).toBe(2);
    expect(resumo.ignorados).toBe(1); // "PRÓXIMAS FATURAS" nunca virou lançamento
    expect(resumo.despesasCentavos).toBe(12208);
    expect(resumo.pagamentosCentavos).toBe(50000); // não confundido com despesa
    expect(resumo.estornosCentavos).toBe(0);

    // Sem "total da fatura" nesta amostra: a conferência geral fica explicitamente aberta.
    const metadados = extrairMetadadosFatura(FATURAS_ANONIMIZADAS.itau.join("\n"));
    expect(metadados.totalFaturaCentavos).toBeNull();
    expect(conferirFatura(resumo.saldoCentavos, metadados.totalFaturaCentavos).confere).toBe(false);
  });

  test("santander: pagamento de fatura e despesa distinguidos mesmo com sinal ao final do valor", () => {
    const { lancamentos } = construirLancamentos(FATURAS_ANONIMIZADAS.santander);
    const resumo = resumirLancamentos(lancamentos);
    expect(resumo.pagamentosCentavos).toBe(70000);
    expect(resumo.despesasCentavos).toBe(8542);
  });
});
