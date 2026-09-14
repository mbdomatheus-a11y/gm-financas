import { describe, expect, test } from "bun:test";

import { limparDescricaoComercial } from "./texto-fatura";

describe("limparDescricaoComercial", () => {
  test.each([
    // Pernambucanas/Elo: "PARC.N/M" seguido de cidade/UF colada.
    ["PERNAMBUCANAS 377 PARC.9/10 São Paulo/Brasil 0", "PERNAMBUCANAS 377"],
    ["Porto Seguro Parc.8/12", "Porto Seguro"],
    // Nubank: "Nome - Parcela N/M" — sobra um "-" solto depois do corte.
    ["Petz - Parcela 2/3", "Petz"],
    ["Porto Seguro Cia Seg G - Parcela 10/12", "Porto Seguro Cia Seg G"],
    // Itaú: cidade/código colado no fim, sem relação com "PARC".
    ["EBN CANVA04995 40 CURITIBA 076 CURITIBA/076", "EBN CANVA04995 40 CURITIBA 076"],
    ["Tokio Marine AUTO02D12 Sao Paulo 076 Sao PAULO/076", "Tokio Marine AUTO02D12 Sao Paulo 076"],
    ["Ifd Ifood Club Osasco 076 OSASCO/076", "Ifd Ifood Club Osasco 076"],
  ] as const)("limpa %s", (entrada, esperado) => {
    expect(limparDescricaoComercial(entrada)).toBe(esperado);
  });

  test("não mexe em parcela nua (sem letra antes da barra)", () => {
    expect(limparDescricaoComercial("PAG*RiotGameSa 02/03")).toBe("PAG*RiotGameSa 02/03");
    expect(limparDescricaoComercial("Benipetsao Pau 01/02")).toBe("Benipetsao Pau 01/02");
  });

  test("descrição sem PARC nem sufixo de cidade fica intacta", () => {
    expect(limparDescricaoComercial("Loja Exemplo")).toBe("Loja Exemplo");
  });

  test("nunca devolve vazio — mantém o texto original se a limpeza apagaria tudo", () => {
    expect(limparDescricaoComercial("PARC.1/2")).toBe("PARC.1/2");
  });
});
