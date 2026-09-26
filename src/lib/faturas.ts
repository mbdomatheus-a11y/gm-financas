import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { addMonths, parseDate, toISODate } from "@/lib/format";
import {
  assinaturaDocumento,
  calcularTotalFatura,
  conferirTotal,
  extrairPosicional,
  type ItemPdf,
  type PerfilLayout,
} from "@/lib/fatura-layout";
import { ehLinhaResumoFatura, extrairMetadadosFatura } from "@/lib/fatura-metadados";
import { extrairLimites, type LimitesFatura } from "@/lib/fatura-limites";
import { ehValorCredito } from "@/lib/lancamento-direcao";
import { identificarParcela } from "@/lib/parcela";
import {
  corrigirTexto,
  limparDescricaoComercial,
  normalizarDescricao,
  parseValor,
} from "@/lib/texto-fatura";

export { extrairLimites, type LimitesFatura };
export { calcularTotalFatura, conferirTotal };
export { corrigirTexto, limparDescricaoComercial, normalizarDescricao, parseValor };

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
  senha?: string,
): Promise<{ texto: string; paginas: number; itens: ItemPdf[]; origem: "pdf" | "ocr" }> {
  const data = new Uint8Array(await file.arrayBuffer());
  let doc: PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument(senha ? { data, password: senha } : { data }).promise;
  } catch (erro) {
    const detalhe = erro instanceof Error ? `${erro.name} ${erro.message}` : String(erro);
    if (/password|senha/i.test(detalhe)) {
      // Sem senha informada: pede senha. Com senha informada e ainda assim
      // rejeitado: a senha está errada — mesmo código, a UI decide o texto.
      throw new ErroLeituraPdf(
        "senha_necessaria",
        senha ? "Senha incorreta. Tente novamente." : "O PDF está protegido por senha.",
      );
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

// corrigirTexto/normalizarDescricao/parseValor moraram aqui antes; agora
// vivem em @/lib/texto-fatura (reexportadas acima) pra poder ser usadas
// também por fatura-layout.ts sem puxar o pdfjs-dist.

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
const RE_FINAL =
  /final\s*(?:com\s*)?(\d{4})|\(?[*•]{2,4}\s?(\d{4})\)?|[X*•]{3,4}[.\s]*(\d{4})|\d{4}[.\s]+[*X•]{4}[.\s]+[*X•]{4}[.\s]+(\d{4})/gi;

export function extrairFinais(texto: string): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(RE_FINAL)) {
    const final = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (final && /^\d{4}$/.test(final)) out.add(final);
  }
  return Array.from(out);
}

const MESES_MAP: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

export function extrairVencimento(texto: string): string | null {
  const m1 = texto.match(/vencimento[^\d]{0,30}(\d{2})\/(\d{2})\/(\d{2,4})/i);
  if (m1) {
    const [, d, mo, yRaw] = m1;
    const y = yRaw!.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${mo}-${d}`;
  }
  const m2 = texto.match(/(?:vencimento|fatura)[^\d]{0,30}(\d{2})\s+([a-z]{3})\s+(\d{4})/i);
  if (m2) {
    const [, d, mesNome, y] = m2;
    const mo = MESES_MAP[mesNome!.toLowerCase()];
    if (mo) return `${y}-${mo}-${d}`;
  }
  const m3 = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m3 && /vencimento|venc/i.test(texto.slice(Math.max(0, (m3.index ?? 0) - 40), (m3.index ?? 0) + 30))) {
    const [, d, mo, y] = m3;
    return `${y}-${mo}-${d}`;
  }
  return null;
}

export function extrairTotal(texto: string): number | null {
  const m = texto.match(
    /(total\s+(?:da\s+)?fatura|total\s+a\s+pagar|valor\s+total|saldo\s+desta\s+fatura|no\s+valor\s+de)[^\d-]{0,40}(-?\s?R?\$?\s?[\d.]+,\d{2})/i,
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
    const descricaoBruta = corrigirTexto(m[2]!);
    if (!descricaoBruta || descricaoBruta.length < 3) continue;
    const valor = parseValor(m[3]!);
    if (valor === 0) continue;

    const parc = identificarParcela(descricaoBruta);
    const numero = parc?.atual ?? 1;
    const total = parc?.total ?? 1;
    const descricao = limparDescricaoComercial(descricaoBruta);
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
  senha?: string,
): Promise<FaturaExtraida> {
  const [{ texto, paginas, itens, origem }, arquivo_hash] = await Promise.all([
    extrairTexto(file, senha),
    hashArquivo(file),
  ]);
  const banco = detectarBanco(texto, file.name);
  const vencimento = extrairVencimento(texto);
  // O texto do PDF às vezes traz o total colado a outro campo (ex.: "VALOR
  // TOTAL FATURA PAGAMENTO MÍNIMO ... R$ 705,42") e a extração acaba pegando
  // um valor que não é o total real. Por isso o campo "Total da fatura" não
  // usa mais esse texto: ele é a soma dos lançamentos (ver `calcularTotalFatura`),
  // assim o usuário consegue conferir contra a fatura de verdade e perceber se
  // falta algum lançamento. O texto extraído só serve de fallback quando a
  // leitura não encontrou nenhum lançamento (nada para somar).
  const totalTexto = extrairTotal(texto);

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

  if (!lancamentos.length && !vencimento && totalTexto == null) {
    throw new ErroLeituraPdf(
      "sem_conteudo_util",
      "O documento foi aberto, mas não contém uma fatura reconhecível.",
    );
  }

  // Sem lançamentos não há o que somar — cai para o valor lido do texto (se
  // houver) só pra não deixar o campo vazio; com lançamentos, o calculado
  // manda, mesmo que dê 0 (fatura só com pagamento, por exemplo).
  const total_declarado = lancamentos.length ? calcularTotalFatura(lancamentos) : totalTexto;

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
  const parsed = parseDate(vencimentoFatura);
  if (isNaN(parsed.getTime())) {
    return toISODate(new Date());
  }
  return toISODate(addMonths(parsed, alvo - parcelaAtual));
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
