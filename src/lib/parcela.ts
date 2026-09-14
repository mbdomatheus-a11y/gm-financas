/**
 * Identificação de parcela em descrições já isoladas — coluna de descrição
 * de uma fatura em PDF (posicional ou linha-a-linha) e texto de OCR.
 *
 * Fonte única de verdade: antes desta consolidação, `faturas.ts` e
 * `fatura-layout.ts` tinham cada um seu próprio regex de parcela,
 * ligeiramente diferentes, causando comportamento inconsistente entre os
 * dois caminhos de leitura. Testado contra faturas reais (Itaú, Nubank,
 * Pernambucanas) para cobrir os formatos realmente usados pelos emissores:
 *
 * - `PARC.9/10`, `PARC. 01 DE 03`, `parcela 2/3` — âncora por palavra-chave.
 * - `2ª de 3` — âncora por ordinal.
 * - `02/03`, `01/02` — fração "nua" (sem palavra-chave), inclusive com
 *   **zero à esquerda**. O Itaú, em especial, grava a maioria das compras
 *   parceladas assim (ex. "PAG*RiotGameSa 02/03"), sem nenhuma palavra
 *   "parc" na frente.
 *
 * Este módulo é deliberadamente mais permissivo que
 * `extrairParcelaSegura` (`importacao-modelo.ts`): aquele existe para texto
 * livre não segmentado, onde uma fração "nua" pode genuinamente ser uma
 * data (por isso rejeita zero à esquerda). Aqui o texto de entrada já é só
 * a descrição do lançamento — a data já foi lida de uma coluna/campo
 * separado antes — então esse risco não existe, e é seguro aceitar o
 * formato real dos emissores.
 */

export type Parcela = { atual: number; total: number };

function valida(atual: number, total: number): boolean {
  return atual > 0 && total > 1 && atual <= total && total <= 99;
}

/**
 * Formas ancoradas por palavra-chave ou separador por extenso — nunca
 * ambíguas com data.
 */
const PADROES_ANCORADOS = [
  /\bparc(?:ela)?\.?\s*n?[ºo°]?\s*(\d{1,2})\s*(?:\/|de|d|ª\s*de)\s*(\d{1,2})\b/i,
  /\b(\d{1,2})\s*(?:de|d|ª\s*de)\s*(\d{1,2})\b/i,
];

/** Fração "nua" separada por barra, ex. "02/03" — aceita zero à esquerda. */
const PADRAO_FRACAO_BARRA = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;

/**
 * Identifica parcela numa descrição já isolada da data. Tenta as formas
 * ancoradas primeiro (mais específicas) e só depois a fração nua.
 */
export function identificarParcela(texto: string): Parcela | null {
  for (const padrao of PADROES_ANCORADOS) {
    const m = texto.match(padrao);
    if (!m) continue;
    const atual = Number(m[1]);
    const total = Number(m[2]);
    if (valida(atual, total)) return { atual, total };
  }
  const m = texto.match(PADRAO_FRACAO_BARRA);
  if (!m) return null;
  const atual = Number(m[1]);
  const total = Number(m[2]);
  return valida(atual, total) ? { atual, total } : null;
}
