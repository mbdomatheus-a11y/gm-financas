import { describe, expect, test } from "bun:test";

import { extrairLimites } from "./fatura-limites";

describe("extrairLimites", () => {
  test("layout Itaú/Pernambucanas: Limite Rotativo + saldos da fatura", () => {
    const texto = `
      LINHA DE CRÉDITO
      Limite Rotativo R$ 5.000,00
      Saldo próxima fatura R$ 1.234,56
    `;
    expect(extrairLimites(texto)).toEqual({
      limite_total: 5000,
      limite_utilizado: 1234.56,
      limite_disponivel: 3765.44,
    });
  });

  test("layout Itaú: soma múltiplos saldos (nacional + internacional)", () => {
    const texto = `
      Limite Rotativo R$ 8.000,00
      Saldo próxima fatura nacional R$ 1.000,00
      Saldo próxima fatura internacional R$ 500,00
    `;
    expect(extrairLimites(texto)).toEqual({
      limite_total: 8000,
      limite_utilizado: 1500,
      limite_disponivel: 6500,
    });
  });

  test("corrige valor com ponto como separador decimal (bug real Pernambucanas: 'R$ 375.44')", () => {
    // Antes da Etapa B, o regex de valor exigia vírgula decimal e essa linha
    // era simplesmente ignorada — o limite utilizado ficava null sem erro.
    const texto = `
      Limite Rotativo R$ 1.200,00
      Saldo próxima fatura R$ 375.44
    `;
    expect(extrairLimites(texto)).toEqual({
      limite_total: 1200,
      limite_utilizado: 375.44,
      limite_disponivel: 824.56,
    });
  });

  test("tabela genérica 'Limites disponíveis' com rótulos e valores em blocos separados", () => {
    const texto = `
      Limites disponíveis do cartão
      Limite total | Utilizado | Disponível
      R$ 5.000,00 R$ 1.500,00 R$ 3.500,00
    `;
    expect(extrairLimites(texto)).toEqual({
      limite_total: 5000,
      limite_utilizado: 1500,
      limite_disponivel: 3500,
    });
  });

  test("tabela genérica sem rótulos batendo 1-a-1 com os valores: maior valor é o limite total", () => {
    const texto = `
      Limites disponíveis do cartão
      Utilizado
      R$ 3.500,00 R$ 5.000,00
    `;
    expect(extrairLimites(texto)).toEqual({
      limite_total: 5000,
      limite_utilizado: 3500,
      limite_disponivel: 1500,
    });
  });

  test("genérico por rótulo isolado: só 'limite total' e 'limite disponível' no texto", () => {
    const texto = `
      Limite total de crédito: R$ 2.000,00
      Limite total disponível: R$ 800,00
    `;
    expect(extrairLimites(texto)).toEqual({
      limite_total: 2000,
      limite_utilizado: 1200,
      limite_disponivel: 800,
    });
  });

  test("nenhuma informação de limite no texto: tudo null", () => {
    const texto = "PADARIA DO BAIRRO 12/08 R$ 45,90";
    expect(extrairLimites(texto)).toEqual({
      limite_total: null,
      limite_utilizado: null,
      limite_disponivel: null,
    });
  });

  test("coerência: se o 'utilizado' capturado for maior que o 'total', o maior vira o total e o outro é descartado", () => {
    const texto = `
      Limite total de crédito: R$ 1.000,00
      Limite total utilizado: R$ 1.800,00
    `;
    const r = extrairLimites(texto);
    expect(r.limite_total).toBe(1800);
    expect(r.limite_utilizado).toBeNull();
  });

  test("sem saldo, o layout 'Limite Rotativo' cai no casamento genérico por rótulo (fallback 0 quando só há valor zerado)", () => {
    const texto = `
      Limite Rotativo R$ 0,00
    `;
    // limitesItau() exige total > 0 para aceitar o layout dedicado, então não é
    // usado aqui; sobra o casamento genérico por rótulo, cujo fallback (quando só
    // existe valor zerado) é devolver esse zero em vez de null.
    const r = extrairLimites(texto);
    expect(r.limite_total).toBe(0);
  });
});
