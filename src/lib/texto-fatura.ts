/**
 * Funções puras de texto/número usadas na leitura de faturas (correção de
 * acentuação, normalização de descrição, parse de valor monetário).
 *
 * Ficam num módulo próprio, sem nenhuma outra dependência, para poder ser
 * importadas tanto por `faturas.ts` (que puxa `pdfjs-dist`, incompatível com
 * `bun test`) quanto por `fatura-layout.ts` — assim `fatura-layout.ts` fica
 * livre da cadeia de import do pdfjs e pode ter testes automatizados de
 * verdade (ver `fatura-layout.test.ts`).
 */

const MOJIBAKE: Record<string, string> = {
  "Ã¡": "á",
  "Ã ": "à",
  "Ã¢": "â",
  "Ã£": "ã",
  "Ã©": "é",
  Ãª: "ê",
  "Ã­": "í",
  "Ã³": "ó",
  "Ã´": "ô",
  Ãµ: "õ",
  Ãº: "ú",
  "Ã§": "ç",
  "Ã‰": "É",
  Ãƒ: "Ã",
  "Ã‡": "Ç",
  "Ã”": "Ô",
  "Ã•": "Õ",
  "Ã": "Á",
  Ãš: "Ú",
  Âº: "º",
  Âª: "ª",
};
/** Só corrige quando o texto realmente veio com bytes UTF-8 lidos como latin-1. */
const RE_MOJIBAKE = /[ÃÂ][-¿–-‰Œ-Ÿ]/;

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "no", "na", "para", "com"]);

/** Corrige acentuação quebrada do PDF e deixa nomes em maiúsculas com capitalização legível. */
export function corrigirTexto(raw: string): string {
  let s = raw;
  if (RE_MOJIBAKE.test(s)) {
    for (const [de, para] of Object.entries(MOJIBAKE)) s = s.split(de).join(para);
  }
  s = s.replace(/\s+/g, " ").trim();

  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const tudoMaiusculo = letras.length > 3 && letras === letras.toUpperCase();
  if (!tudoMaiusculo) return s;

  return s
    .split(" ")
    .map((p, i) => {
      const baixo = p.toLocaleLowerCase("pt-BR");
      if (/\d/.test(p) || (p.length <= 3 && !/[aeiouáéíóúâêôãõ]/i.test(p))) return p; // siglas
      if (i > 0 && MINUSCULAS.has(baixo)) return baixo;
      return baixo.charAt(0).toLocaleUpperCase("pt-BR") + baixo.slice(1);
    })
    .join(" ");
}

export function normalizarDescricao(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b\d{2}\/\d{2}\b/g, "")
    .replace(/PARC(ELA)?\s*\d+\s*(DE|\/)\s*\d+/g, "")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A partir de "PARC" (com ou sem ".ELA") tudo que vem depois é informação de
// parcela — já extraída à parte por `identificarParcela` — e não deveria
// aparecer na descrição (ex.: "PERNAMBUCANAS 377 PARC.9/10 São Paulo/Brasil
// 0" tem cidade/UF coladas depois da parcela).
const RE_PARC_E_RESTO = /\bPARC(?:ELA)?\.?\s*\d[\s\S]*$/i;

// Sufixo de cidade/local colado no fim da descrição, no formato "Cidade/código"
// (ex.: "CURITIBA/076", "Sao PAULO/076") — comum em faturas do Itaú. Exige
// que o trecho logo antes da "/" comece com letra (no máx. 3 palavras) pra
// nunca confundir com uma parcela "nua" tipo "02/03" (aí antes da "/" vêm só
// dígitos, não letras). Só remove a ÚLTIMA ocorrência: se a cidade aparecer
// também mais cedo na descrição (colada sem separador ao nome do
// estabelecimento), aquela primeira menção fica — não dá pra saber com
// certeza que não faz parte do nome do estabelecimento.
const RE_SUFIXO_CIDADE_CODIGO = /\s+(?:[A-Za-zÀ-ÿ]+\s*){1,3}\/\d{1,4}\s*$/;

/**
 * Remove da descrição informação de parcela e o sufixo final de
 * cidade/código que alguns emissores colam no texto do lançamento — essa
 * informação já é capturada em campos próprios (`parcela_numero`/
 * `parcela_total`) ou simplesmente não é usada pelo app. Nunca devolve uma
 * string vazia: se a limpeza apagaria tudo, mantém o texto original.
 */
export function limparDescricaoComercial(descricao: string): string {
  let s = descricao.replace(RE_PARC_E_RESTO, "").trim();
  // Sobra um separador solto quando o formato é "Nome - Parcela N/M".
  s = s.replace(/[-–,]\s*$/, "").trim();
  s = s.replace(RE_SUFIXO_CIDADE_CODIGO, "").trim();
  return s || descricao.trim();
}

export function parseValor(raw: string): number {
  const limpo = raw.replace(/\s/g, "").replace(/[R$US]/gi, "");
  const negativo = /^-/.test(limpo) || /-$/.test(limpo);
  // Além do "-", um valor pode vir com "+" no final (notação de crédito de
  // alguns emissores, ex. "459,96+") — precisa ser removido antes do
  // Number() também, senão a conversão falha e o valor vira 0 em silêncio.
  const num = Number(limpo.replace(/[-+]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return 0;
  return negativo ? -num : num;
}
