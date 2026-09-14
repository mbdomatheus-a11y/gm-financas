/**
 * Decide se um lançamento de fatura é um crédito (estorno, devolução,
 * pagamento recebido — reduz o valor devido) ou uma despesa comum (débito).
 *
 * Fonte única de verdade: antes desta consolidação, `faturas.ts`,
 * `fatura-layout.ts` e `ocr.ts` tinham cada um sua própria lógica —
 * `fatura-layout.ts` com uma função `ehCredito` completa (palavra-chave +
 * sinal), os outros dois só olhando se o valor final ficou negativo.
 *
 * Bug real encontrado (2026-09-13) numa fatura Elo/Pernambucanas: o emissor
 * marca **todo** valor com um sinal DEPOIS do número — "50,04-" para uma
 * compra normal, "459,96+" para um pagamento/estorno. `parseValor` lia
 * qualquer sinal (à frente OU atrás) como "número negativo", e o código
 * tratava "número negativo" como sinônimo de crédito. Resultado: toda
 * compra normal da fatura (sinal "-" no fim) virava "crédito" e, no
 * caminho posicional (`fatura-layout.ts`), crédito é automaticamente
 * marcado como `incluir: false` — ou seja, a fatura inteira era lida e
 * **excluída da importação por padrão**, sem erro nenhum.
 *
 * As duas notações de sinal não são a mesma coisa e podem ter significado
 * OPOSTO:
 * - Sinal à FRENTE do valor ("-R$ 50,00"): notação matemática comum,
 *   usada por alguns emissores para destacar um estorno/crédito.
 * - Sinal DEPOIS do valor ("50,00-" / "50,00+"): notação contábil de
 *   lançamento (D/C) usada por outros emissores (confirmado na fatura
 *   Elo/Pernambucanas) — "-" é despesa comum, "+" é o que reduz a fatura.
 *
 * Por isso o sinal-atrás manda quando presente (é o mais explícito e o
 * único jeito de identificar, por exemplo, um estorno como "IFD IFOOD
 * 1,00+", que não tem nenhuma palavra-chave de estorno na descrição). Só
 * na ausência de sinal-atrás é que um sinal-à-frente isolado é lido como
 * crédito. Palavras-chave (pagamento, estorno, cashback...) são checadas
 * sempre, independente do sinal, para pegar casos sem nenhum sinal.
 */

const PALAVRAS_CREDITO = [
  "pagamento",
  "estorno",
  "devolucao",
  "credito recebido",
  "cashback",
  "reembolso",
  "ajuste a credito",
];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * @param valorBruto Texto do valor tal como aparece na fatura, com o(s)
 *   sinal(is) originais (ex. "50,04-", "-R$ 50,04", "(50,04)").
 * @param textoLinha Descrição/linha completa do lançamento, usada para o
 *   casamento por palavra-chave.
 */
export function ehValorCredito(valorBruto: string, textoLinha = ""): boolean {
  const v = valorBruto.trim();

  if (/^\(.*\)$/.test(v)) return true; // notação contábil entre parênteses

  const sinalAtras = v.match(/([+-])\s*$/);
  if (sinalAtras) {
    if (sinalAtras[1] === "+") return true;
    // sinal-atrás "-": despesa comum nessa notação — não decide sozinho,
    // mas também não é motivo para não checar as palavras-chave abaixo.
  } else if (/^\s*-/.test(v)) {
    return true; // sinal só à frente, sem sinal atrás: notação matemática de crédito
  }

  const t = semAcento(textoLinha);
  return PALAVRAS_CREDITO.some((c) => t.includes(semAcento(c)));
}
