import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";


import { addMonths, parseDate, toISODate } from "@/lib/format";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export type BancoFatura = "itau" | "nubank" | "pernambucanas" | "santander" | "desconhecido";

export const BANCO_LABEL: Record<BancoFatura, string> = {
  itau: "Itaú",
  nubank: "Nubank",
  pernambucanas: "Pernambucanas",
  santander: "Santander",
  desconhecido: "Não identificado",
};

export type LancamentoExtraido = {
  id: string;
  data_compra: string;
  descricao: string;
  descricao_normalizada: string;
  valor: number;
  moeda: "BRL" | "USD";
  direcao: "debito" | "credito";
  parcela_numero: number;
  parcela_total: number;
  cartao_final: string | null;
  responsavel: string | null;
  categoria: string;
  confianca_data: "alta" | "media" | "baixa";
  valor_estimado: boolean;
  incluir: boolean;
};

export type FaturaExtraida = {
  banco: BancoFatura;
  arquivo_nome: string;
  arquivo_hash: string;
  paginas: number;
  vencimento: string | null;
  competencia: string | null;
  total_declarado: number | null;
  limite_total: number | null;
  limite_utilizado: number | null;
  limite_disponivel: number | null;
  finais: string[];
  lancamentos: LancamentoExtraido[];
  texto: string;
};

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

export async function hashArquivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function extrairTexto(file: File): Promise<{ texto: string; paginas: number }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const partes: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let linha = "";
    let lastY: number | null = null;
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform?.[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        partes.push(linha.trim());
        linha = "";
      }
      linha += `${item.str} `;
      lastY = y;
    }
    if (linha.trim()) partes.push(linha.trim());
  }
  return { texto: partes.filter(Boolean).join("\n"), paginas: doc.numPages };
}

export function detectarBanco(texto: string, nomeArquivo: string): BancoFatura {
  const alvo = `${nomeArquivo} ${texto}`.toLowerCase();
  if (alvo.includes("nubank") || alvo.includes("nu pagamentos")) return "nubank";
  if (alvo.includes("pernambucanas")) return "pernambucanas";
  if (alvo.includes("santander")) return "santander";
  if (alvo.includes("itau") || alvo.includes("itaú") || alvo.includes("itaucard")) return "itau";
  return "desconhecido";
}

export function normalizarDescricao(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\b\d{2}\/\d{2}\b/g, "")
    .replace(/PARC(ELA)?\s*\d+\s*(DE|\/)\s*\d+/g, "")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseValor(raw: string): number {
  const limpo = raw.replace(/\s/g, "").replace(/[R$US]/gi, "");
  const negativo = /^-/.test(limpo) || /-$/.test(limpo);
  const num = Number(limpo.replace(/-/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return 0;
  return negativo ? -num : num;
}

function parseDataBR(raw: string, anoBase: number): string | null {
  const dm = raw.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?$/);
  if (dm) {
    const [, d, m, y] = dm;
    const ano = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : anoBase;
    return `${ano}-${m}-${d}`;
  }
  const dmTexto = raw.match(/^(\d{1,2})\s+([a-zç]{3})/i);
  if (dmTexto) {
    const mes = MESES[dmTexto[2]!.toLowerCase().slice(0, 3)];
    if (mes) return `${anoBase}-${String(mes).padStart(2, "0")}-${dmTexto[1]!.padStart(2, "0")}`;
  }
  return null;
}

const RE_LINHA =
  /^(\d{2}\/\d{2}(?:\/\d{2,4})?|\d{1,2}\s+[a-zç]{3})\s+(.+?)\s+(-?\s?(?:R\$|US\$)?\s?-?\d{1,3}(?:\.\d{3})*,\d{2}-?)$/i;
const RE_PARCELA = /(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i;
const RE_FINAL = /final\s*(?:com\s*)?(\d{4})|\(?\*{2,4}\s?(\d{4})\)?|x{4}\s?(\d{4})/gi;

export function extrairFinais(texto: string): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(RE_FINAL)) {
    const final = m[1] ?? m[2] ?? m[3];
    if (final) out.add(final);
  }
  return Array.from(out);
}

export function extrairVencimento(texto: string): string | null {
  const m = texto.match(/vencimento[^\d]{0,20}(\d{2}\/\d{2}\/\d{4})/i);
  if (!m) return null;
  const [d, mo, y] = m[1]!.split("/");
  return `${y}-${mo}-${d}`;
}

export function extrairTotal(texto: string): number | null {
  const m = texto.match(
    /(total\s+(?:da\s+)?fatura|valor\s+total|total\s+a\s+pagar)[^\d-]{0,30}(-?\s?R?\$?\s?[\d.]+,\d{2})/i,
  );
  return m ? parseValor(m[2]!) : null;
}

export type LimitesFatura = {
  limite_total: number | null;
  limite_utilizado: number | null;
  limite_disponivel: number | null;
};

const VALOR = String.raw`(R?\$?\s?[\d.]+,\d{2})`;
const RE_VALOR_G = /R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2}/g;

/** Pega o primeiro valor não-zero encontrado; se todos forem zero, devolve o primeiro. */
function primeiroValor(texto: string, re: RegExp): number | null {
  let fallback: number | null = null;
  for (const m of texto.matchAll(re)) {
    const v = parseValor(m[1]!);
    if (v > 0) return v;
    if (fallback === null) fallback = v;
  }
  return fallback;
}

/** Tabelas do tipo "Utilizado | Disponível | Limite total" com os valores em outra linha. */
function limitesTabela(texto: string): LimitesFatura | null {
  const m = texto.match(/limites?\s+(?:dispon[ií]ve(?:l|is)|do\s+cart[aã]o|de\s+cr[eé]dito)([\s\S]{0,260})/i);
  if (!m) return null;
  const bloco = m[1]!;
  const primeiroNum = bloco.search(/\d{1,3}(?:\.\d{3})*,\d{2}/);
  if (primeiroNum < 0) return null;
  const cabecalho = bloco.slice(0, primeiroNum);
  const labels = Array.from(
    cabecalho.matchAll(/(limite\s+total|total|utilizado|dispon[ií]vel)/gi),
    (x) => x[1]!.toLowerCase(),
  );
  const valores = Array.from(bloco.slice(primeiroNum).matchAll(RE_VALOR_G), (x) => parseValor(x[0]))
    .filter((v) => v > 0)
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

/** Itaú: "LINHA DE CRÉDITO / Limite Rotativo ..." + saldos da fatura. */
function limitesItau(texto: string): LimitesFatura | null {
  const rot = texto.match(
    new RegExp(String.raw`limite\s+rotativo[^\d]{0,120}` + VALOR, "i"),
  );
  if (!rot) return null;
  const total = parseValor(rot[1]!);
  if (!(total > 0)) return null;

  const saldos = Array.from(
    texto.matchAll(new RegExp(String.raw`saldo\s+(?:pr[oó]xima\s+fatura|futuro)[^\d]{0,120}` + VALOR, "gi")),
    (m) => parseValor(m[1]!),
  ).filter((v) => v > 0);

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

  let limite_total = total ?? tabela?.limite_total ?? itau?.limite_total ?? null;
  let limite_disponivel = disponivel ?? tabela?.limite_disponivel ?? itau?.limite_disponivel ?? null;
  let limite_utilizado = utilizado ?? tabela?.limite_utilizado ?? itau?.limite_utilizado ?? null;

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



/** Extração genérica: linhas "data descrição valor". Os parsers por banco refinam esse resultado. */
export function extrairLancamentos(texto: string, vencimento: string | null): LancamentoExtraido[] {
  const anoBase = vencimento ? Number(vencimento.slice(0, 4)) : new Date().getFullYear();
  const finaisPorLinha = extrairFinais(texto);
  const out: LancamentoExtraido[] = [];
  let seq = 0;

  for (const linha of texto.split("\n")) {
    const m = linha.trim().match(RE_LINHA);
    if (!m) continue;
    const data = parseDataBR(m[1]!.trim(), anoBase);
    if (!data) continue;
    const descricao = m[2]!.replace(/\s+/g, " ").trim();
    if (!descricao || descricao.length < 3) continue;
    const valor = parseValor(m[3]!);
    if (valor === 0) continue;

    const parc = descricao.match(RE_PARCELA);
    const numero = parc ? Number(parc[1]) : 1;
    const total = parc ? Number(parc[2]) : 1;
    const moeda: "BRL" | "USD" = /US\$|USD|dolar|dólar/i.test(linha) ? "USD" : "BRL";

    out.push({
      id: `l${seq++}`,
      data_compra: data,
      descricao,
      descricao_normalizada: normalizarDescricao(descricao),
      valor: Math.abs(valor),
      moeda,
      direcao: valor < 0 ? "credito" : "debito",
      parcela_numero: numero > 0 && numero <= total ? numero : 1,
      parcela_total: total >= 1 && total <= 99 ? total : 1,
      cartao_final: finaisPorLinha.length === 1 ? finaisPorLinha[0]! : null,
      responsavel: null,
      categoria: "outros",
      confianca_data: /\d{2}\/\d{2}\/\d{2,4}/.test(m[1]!) ? "alta" : "media",
      valor_estimado: false,
      incluir: true,
    });
  }
  return out;
}

export async function processarFatura(file: File): Promise<FaturaExtraida> {
  const [{ texto, paginas }, arquivo_hash] = await Promise.all([
    extrairTexto(file),
    hashArquivo(file),
  ]);
  const banco = detectarBanco(texto, file.name);
  const vencimento = extrairVencimento(texto);
  return {
    banco,
    arquivo_nome: file.name,
    arquivo_hash,
    paginas,
    vencimento,
    competencia: vencimento ? vencimento.slice(0, 7) : null,
    total_declarado: extrairTotal(texto),
    ...extrairLimites(texto),
    finais: extrairFinais(texto),
    lancamentos: extrairLancamentos(texto, vencimento),
    texto,
  };
}

/** Vencimento da parcela N a partir do vencimento da fatura e do número da parcela atual. */
export function vencimentoParcela(
  vencimentoFatura: string,
  parcelaAtual: number,
  alvo: number,
): string {
  return toISODate(addMonths(parseDate(vencimentoFatura), alvo - parcelaAtual));
}

export function dedupKey(l: {
  data_compra: string;
  descricao_normalizada: string;
  valor: number;
  parcela_numero: number;
  parcela_total: number;
  cartao_final: string | null;
}): string {
  return [
    l.data_compra,
    l.descricao_normalizada,
    l.valor.toFixed(2),
    `${l.parcela_numero}/${l.parcela_total}`,
    l.cartao_final ?? "-",
  ].join("|");
}
