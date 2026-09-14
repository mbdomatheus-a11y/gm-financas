/**
 * Leitura de limites de crédito a partir do texto da fatura.
 *
 * Extraído de `faturas.ts` para poder ser testado isoladamente: `faturas.ts`
 * importa `pdfjs-dist` (só roda no navegador/Vite), então nenhuma função de
 * lá pode ser testada com `bun test` sem o build completo.
 *
 * Etapa B (2026-09-13): antes, os regex de valor deste arquivo exigiam
 * vírgula como separador decimal (`,\d{2}` no fim). Uma fatura real da
 * Pernambucanas testada tinha uma linha com o separador errado ("R$
 * 375.44", ponto em vez de vírgula) — o valor era simplesmente ignorado,
 * sem erro. Agora os valores capturados passam por `lerValorMonetario`
 * (`importacao-modelo.ts`), que já decide corretamente qual separador é o
 * decimal (o que aparece por último, seguido de até 2 dígitos).
 *
 * Limite conhecido, não resolvido aqui: alguns emissores (ex. a mesma
 * fatura Pernambucanas) têm **vários limites nomeados** (Rotativo, Parcela
 * Fácil, Retirada País) em vez de um único total/utilizado/disponível — não
 * há como saber com certeza qual desses é "o limite do cartão" sem uma
 * fatura de referência por emissor. Por isso a importação do limite deve
 * ser opcional (ver plano de importação, Etapa D).
 */
import { lerValorMonetario } from "@/lib/importacao-modelo";

export type LimitesFatura = {
  limite_total: number | null;
  limite_utilizado: number | null;
  limite_disponivel: number | null;
};

/** Valor monetário aceitando vírgula OU ponto como separador decimal. */
const VALOR = String.raw`(R?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})`;
const RE_VALOR_G = /R?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}/g;

function lerValor(raw: string): number | null {
  const lido = lerValorMonetario(raw);
  return lido ? lido.centavosAbsolutos / 100 : null;
}

/** Pega o primeiro valor não-zero encontrado; se todos forem zero, devolve o primeiro. */
function primeiroValor(texto: string, re: RegExp): number | null {
  let fallback: number | null = null;
  for (const m of texto.matchAll(re)) {
    const v = lerValor(m[1]!);
    if (v == null) continue;
    if (v > 0) return v;
    if (fallback === null) fallback = v;
  }
  return fallback;
}

/** Tabelas do tipo "Utilizado | Disponível | Limite total" com os valores em outra linha. */
function limitesTabela(texto: string): LimitesFatura | null {
  const m = texto.match(
    /limites?\s+(?:dispon[ií]ve(?:l|is)|do\s+cart[aã]o|de\s+cr[eé]dito)([\s\S]{0,260})/i,
  );
  if (!m) return null;
  const bloco = m[1]!;
  const primeiroNum = bloco.search(/\d{1,3}(?:[.,]\d{3})*[.,]\d{2}/);
  if (primeiroNum < 0) return null;
  const cabecalho = bloco.slice(0, primeiroNum);
  const labels = Array.from(
    cabecalho.matchAll(/(limite\s+total|total|utilizado|dispon[ií]vel)/gi),
    (x) => x[1]!.toLowerCase(),
  );
  const valores = Array.from(bloco.slice(primeiroNum).matchAll(RE_VALOR_G), (x) => lerValor(x[0]))
    .filter((v): v is number => v != null && v > 0)
    .slice(0, 4);
  if (!labels.length || !valores.length) return null;

  let total: number | null = null;
  let utilizado: number | null = null;
  let disponivel: number | null = null;

  if (labels.length === valores.length) {
    labels.forEach((l, i) => {
      const v = valores[i]!;
      if (l.includes("total")) total = v;
      else if (l.startsWith("utilizado")) utilizado = v;
      else disponivel = v;
    });
  } else {
    // Cabeçalho e valores não batem: o maior valor é o limite total.
    total = Math.max(...valores);
    const resto = valores.filter((v) => v !== total);
    if (resto.length === 1) {
      if (labels.some((l) => l.startsWith("utilizado"))) utilizado = resto[0]!;
      else disponivel = resto[0]!;
    }
  }
  if (total == null) return null;
  return { limite_total: total, limite_utilizado: utilizado, limite_disponivel: disponivel };
}

/**
 * "LINHA DE CRÉDITO / Limite Rotativo ..." + saldos da fatura. Apesar do
 * nome, não é exclusivo do Itaú — o padrão "Limite Rotativo" também aparece
 * em faturas da Pernambucanas, por exemplo.
 */
function limitesItau(texto: string): LimitesFatura | null {
  const rot = texto.match(new RegExp(String.raw`limite\s+rotativo[^\d]{0,120}` + VALOR, "i"));
  if (!rot) return null;
  const total = lerValor(rot[1]!);
  if (total == null || !(total > 0)) return null;

  const saldos = Array.from(
    texto.matchAll(
      new RegExp(String.raw`saldo\s+(?:pr[oó]xima\s+fatura|futuro)[^\n]*?` + VALOR, "gi"),
    ),
    (m) => lerValor(m[1]!),
  ).filter((v): v is number => v != null && v > 0);

  const utilizado = saldos.length ? Number(saldos.reduce((s, v) => s + v, 0).toFixed(2)) : null;
  return {
    limite_total: total,
    limite_utilizado: utilizado,
    limite_disponivel: utilizado == null ? null : Number((total - utilizado).toFixed(2)),
  };
}

/** Lê limite total, utilizado e disponível do texto da fatura (Itaú, Nubank, Santander, Pernambucanas). */
export function extrairLimites(texto: string): LimitesFatura {
  const total = primeiroValor(
    texto,
    new RegExp(
      String.raw`limite\s+(?:total(?!\s*(?:utilizado|dispon))(?:\s+de\s+cr[eé]dito|\s+do\s+cart[aã]o[^:\n]{0,30})?|de\s+cr[eé]dito|rotativo)[^\d]{0,80}` +
        VALOR,
      "gi",
    ),
  );
  const disponivel = primeiroValor(
    texto,
    new RegExp(String.raw`limite\s+(?:total\s+)?dispon[ií]vel[^\d]{0,80}` + VALOR, "gi"),
  );
  const utilizado = primeiroValor(
    texto,
    new RegExp(String.raw`limite\s+(?:total\s+)?utilizado[^\d]{0,80}` + VALOR, "gi"),
  );

  const tabela = limitesTabela(texto);
  const itau = limitesItau(texto);

  // Tabelas e o layout "Limite Rotativo" são mais confiáveis que o casamento genérico por rótulo.
  let limite_total = tabela?.limite_total ?? itau?.limite_total ?? total ?? null;
  let limite_disponivel =
    tabela?.limite_disponivel ?? itau?.limite_disponivel ?? disponivel ?? null;
  let limite_utilizado = tabela?.limite_utilizado ?? itau?.limite_utilizado ?? utilizado ?? null;

  // Coerência: o limite total nunca é menor que utilizado/disponível.
  const maior = Math.max(limite_total ?? 0, limite_utilizado ?? 0, limite_disponivel ?? 0);
  if (limite_total != null && maior > limite_total) {
    if (limite_utilizado === maior) limite_utilizado = null;
    else if (limite_disponivel === maior) limite_disponivel = null;
    limite_total = maior;
  }

  if (limite_total != null && limite_disponivel != null && limite_utilizado == null) {
    limite_utilizado = Number((limite_total - limite_disponivel).toFixed(2));
  }
  if (limite_total != null && limite_utilizado != null && limite_disponivel == null) {
    limite_disponivel = Number((limite_total - limite_utilizado).toFixed(2));
  }
  return { limite_total, limite_utilizado, limite_disponivel };
}
