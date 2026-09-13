import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { addMonths, parseDate, toISODate } from "@/lib/format";
import {
  assinaturaDocumento,
  conferirTotal,
  extrairPosicional,
  type ItemPdf,
  type PerfilLayout,
} from "@/lib/fatura-layout";
import { ehLinhaResumoFatura, extrairMetadadosFatura } from "@/lib/fatura-metadados";
import { extrairLimites, type LimitesFatura } from "@/lib/fatura-limites";
import { ehValorCredito } from "@/lib/lancamento-direcao";
import { identificarParcela } from "@/lib/parcela";

export { extrairLimites, type LimitesFatura };

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
  subcategoria?: string | null;
  categoria_sugerida?: string | null;
  confianca_categoria?: "alta" | "media" | "baixa";
  tipo?: "fixa" | "variavel";
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
  assinatura?: string;
  leitura?: "perfil" | "posicional" | "linhas" | "ocr";
  colunas?: {
    data?: number | undefined;
    valor?: number | undefined;
    descricao?: number | undefined;
  };
  conferencia?: { ok: boolean; soma: number; diferenca: number | null };
  periodo?: { inicio: string | null; fim: string | null };
  titulares?: string[];
  subtotais?: Array<{ rotulo: string; valor: number }>;
  origem_texto?: "pdf" | "ocr";
};

export type CodigoErroLeituraPdf = "arquivo_invalido" | "senha_necessaria" | "sem_conteudo_util";

export class ErroLeituraPdf extends Error {
  constructor(
    public readonly codigo: CodigoErroLeituraPdf,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroLeituraPdf";
  }
}

const MESES: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

export async function hashArquivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function extrairTexto(
  file: File,
): Promise<{ texto: string; paginas: number; itens: ItemPdf[]; origem: "pdf" | "ocr" }> {
  const data = new Uint8Array(await file.arrayBuffer());
  let doc: PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (erro) {
    const detalhe = erro instanceof Error ? `${erro.name} ${erro.message}` : String(erro);
    if (/password|senha/i.test(detalhe)) {
      throw new ErroLeituraPdf("senha_necessaria", "O PDF está protegido por senha.");
    }
    throw new ErroLeituraPdf(
      "arquivo_invalido",
      "O arquivo não é um PDF válido ou está corrompido.",
    );
  }
  const partes: string[] = [];
  const itens: ItemPdf[] = [];
  const paginasSemTexto: Array<{ numero: number; page: PDFPageProxy }> = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const inicioItens = itens.length;
    let linha = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const textoItem = item as TextItem;
      const y = Math.round(textoItem.transform?.[5] ?? 0);
      const x = Math.round(textoItem.transform?.[4] ?? 0);
      if (textoItem.str.trim()) {
        itens.push({ str: textoItem.str, x, y, w: Number(textoItem.width ?? 0), page: i });
      }
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        partes.push(linha.trim());
        linha = "";
      }
      linha += `${textoItem.str} `;
      lastY = y;
    }
    if (linha.trim()) partes.push(linha.trim());
    const caracteres = itens.slice(inicioItens).reduce((s, item) => s + item.str.trim().length, 0);
    if (caracteres < 20) paginasSemTexto.push({ numero: i, page });
  }

  let origem: "pdf" | "ocr" = "pdf";
  if (paginasSemTexto.length && typeof document !== "undefined") {
    const { ocrPaginaPdf } = await import("@/lib/ocr");
    for (const { numero, page } of paginasSemTexto) {
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const contexto = canvas.getContext("2d");
      if (!contexto) continue;
      await page.render({ canvas, canvasContext: contexto, viewport }).promise;
      const textoOcr = (await ocrPaginaPdf(canvas)).trim();
      if (textoOcr) {
        partes.push(`--- Página ${numero} (OCR) ---`, textoOcr);
        origem = "ocr";
      }
    }
  }

  const texto = partes.filter(Boolean).join("\n");
  if (texto.replace(/[^A-Za-zÀ-ÿ0-9]/g, "").length < 10) {
    throw new ErroLeituraPdf("sem_conteudo_util", "O PDF não possui texto ou imagem legível.");
  }
  return { texto, paginas: doc.numPages, itens, origem };
}

export function detectarBanco(texto: string, nomeArquivo: string): BancoFatura {
  const alvo = `${nomeArquivo} ${texto}`.toLowerCase();
  if (alvo.includes("nubank") || alvo.includes("nu pagamentos")) return "nubank";
  if (alvo.includes("pernambucanas")) return "pernambucanas";
  if (alvo.includes("santander")) return "santander";
  if (alvo.includes("itau") || alvo.includes("itaú") || alvo.includes("itaucard")) return "itau";
  return "desconhecido";
}

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
  "Ã\u0081": "Á",
  Ãš: "Ú",
  Âº: "º",
  Âª: "ª",
};
/** Só corrige quando o texto realmente veio com bytes UTF-8 lidos como latin-1. */
const RE_MOJIBAKE = /[ÃÂ][\u0080-\u00bf\u2013-\u2030\u0152-\u0178]/;

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
  // Além do "-", um valor pode vir com "+" no final (notação de crédito de
  // alguns emissores, ex. "459,96+") — precisa ser removido antes do
  // Number() também, senão a conversão falha e o valor vira 0 em silêncio.
  const num = Number(limpo.replace(/[-+]/g, "").replace(/\./g, "").replace(",", "."));
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

// O valor pode terminar em "-" (despesa comum) ou "+" (crédito/estorno) em
// notação D/C de alguns emissores — ver lancamento-direcao.ts.
const RE_LINHA =
  /^(\d{2}\/\d{2}(?:\/\d{2,4})?|\d{1,2}\s+[a-zç]{3})\s+(.+?)\s+(-?\s?(?:R\$|US\$)?\s?-?\d{1,3}(?:\.\d{3})*,\d{2}\s?[+-]?)$/i;
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

/** Extração genérica: linhas "data descrição valor". Os parsers por banco refinam esse resultado. */
export function extrairLancamentos(texto: string, vencimento: string | null): LancamentoExtraido[] {
  const anoBase = vencimento ? Number(vencimento.slice(0, 4)) : new Date().getFullYear();
  const finaisPorLinha = extrairFinais(texto);
  const out: LancamentoExtraido[] = [];
  let seq = 0;

  for (const linha of texto.split("\n")) {
    if (ehLinhaResumoFatura(linha)) continue;
    const m = linha.trim().match(RE_LINHA);
    if (!m) continue;
    const data = parseDataBR(m[1]!.trim(), anoBase);
    if (!data) continue;
    const descricao = corrigirTexto(m[2]!);
    if (!descricao || descricao.length < 3) continue;
    const valor = parseValor(m[3]!);
    if (valor === 0) continue;

    const parc = identificarParcela(descricao);
    const numero = parc?.atual ?? 1;
    const total = parc?.total ?? 1;
    const moeda: "BRL" | "USD" = /US\$|USD|dolar|dólar/i.test(linha) ? "USD" : "BRL";

    out.push({
      id: `l${seq++}`,
      data_compra: data,
      descricao,
      descricao_normalizada: normalizarDescricao(descricao),
      valor: Math.abs(valor),
      moeda,
      direcao: ehValorCredito(m[3]!, linha) ? "credito" : "debito",
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

export type ConferenciaFatura = { ok: boolean; soma: number; diferenca: number | null };

/**
 * Lê a fatura tentando, nesta ordem: perfil salvo do emissor → leitura posicional
 * genérica → leitura por linha de texto (fallback usado também pelo OCR de prints).
 */
export async function processarFatura(
  file: File,
  perfil?: PerfilLayout | null,
): Promise<FaturaExtraida> {
  const [{ texto, paginas, itens, origem }, arquivo_hash] = await Promise.all([
    extrairTexto(file),
    hashArquivo(file),
  ]);
  const banco = detectarBanco(texto, file.name);
  const vencimento = extrairVencimento(texto);
  const total_declarado = extrairTotal(texto);

  const comPerfil = perfil ? extrairPosicional(itens, vencimento, perfil) : null;
  const generico =
    comPerfil && comPerfil.lancamentos.length ? comPerfil : extrairPosicional(itens, vencimento);
  let lancamentos = generico.lancamentos;
  let leitura: FaturaExtraida["leitura"] = comPerfil?.lancamentos.length ? "perfil" : "posicional";
  let colunas = generico.colunas;

  if (lancamentos.length === 0) {
    lancamentos = extrairLancamentos(texto, vencimento);
    leitura = origem === "ocr" ? "ocr" : "linhas";
    colunas = {};
  }

  if (!lancamentos.length && !vencimento && total_declarado == null) {
    throw new ErroLeituraPdf(
      "sem_conteudo_util",
      "O documento foi aberto, mas não contém uma fatura reconhecível.",
    );
  }

  return {
    banco,
    arquivo_nome: file.name,
    arquivo_hash,
    paginas,
    vencimento,
    competencia: vencimento ? vencimento.slice(0, 7) : null,
    total_declarado,
    ...extrairLimites(texto),
    finais: extrairFinais(texto),
    lancamentos,
    texto,
    assinatura: assinaturaDocumento(texto),
    leitura,
    colunas,
    conferencia: conferirTotal(lancamentos, total_declarado),
    ...extrairMetadadosFatura(texto),
    origem_texto: origem,
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
