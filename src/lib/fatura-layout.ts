/**
 * Leitor posicional de faturas: em vez de depender do layout de cada banco,
 * usa as coordenadas dos fragmentos do PDF para descobrir onde estão data,
 * descrição e valor.
 */
import { corrigirTexto, normalizarDescricao, parseValor, type LancamentoExtraido } from "@/lib/faturas";
import { ehLinhaResumoFatura } from "@/lib/fatura-metadados";

export type ItemPdf = { str: string; x: number; y: number; w: number; page: number };

export type Celula = { texto: string; x: number; w: number };
export type LinhaPdf = { page: number; y: number; celulas: Celula[]; texto: string };

export type PerfilLayout = {
  assinatura: string;
  banco?: string | null;
  colunas: { data?: number | undefined; valor?: number | undefined; descricao?: number | undefined };
  formato_data?: string | null;
  formato_valor?: string | null;
  ancora_inicio?: string | null;
  ancora_fim?: string | null;
};

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const RE_DATA =
  /^(\d{2}\/\d{2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\s*(?:de\s*)?[a-zç]{3,9}\.?(?:\s*(?:de\s*)?\d{2,4})?)$/i;
const RE_VALOR = /^-?\(?\s*(?:R\$|US\$|USD|BRL)?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\s*\)?-?$/i;
const RE_VALOR_SIMPLES = /^-?\(?\s*(?:R\$|US\$|USD)?\s*-?\d+[.,]\d{2}\s*\)?-?$/i;
const RE_PARCELA = /(\d{1,2})\s*(?:\/|de|ª\s*de)\s*(\d{1,2})/i;
const RE_FINAL_LINHA = /(?:final|cart[aã]o|com\s+final)\D{0,12}(\d{4})\b|\*{2,4}\s?(\d{4})|x{4}\s?(\d{4})/i;

/** Linhas que nunca são um gasto, em qualquer banco. */
const RUIDO = [
  "pagamento minimo", "pagamento mínimo", "total a pagar", "total da fatura", "valor total",
  "saldo anterior", "fatura anterior", "cet", "iof previsto",
  "limite", "proximas faturas", "próximas faturas", "resumo", "vencimento", "atendimento",
  "ouvidoria", "sac", "central de", "www.", "cnpj", "pagina", "página", "demonstrativo",
  "parcelamento da fatura", "programa de pontos", "pontos acumulados", "valor do documento",
  "codigo de barras", "código de barras", "linha digitavel", "linha digitável", "boleto",
  "oferta", "contrate", "aproveite", "saldo futuro",
];

const SECAO_IGNORADA = /^(pr[oó]ximas faturas|saldo futuro|lan[cç]amentos futuros|ofertas?|benef[ií]cios|boleto|demonstrativo de limites?)\b/i;
const SECAO_LANCAMENTOS = /^(compras?|despesas?|lan[cç]amentos?|movimenta[cç][aã]o|pagamentos?(?: e demais cr[eé]ditos)?|cr[eé]ditos?|estornos?)\b/i;

const CREDITO = ["pagamento", "estorno", "devolucao", "devolução", "credito recebido", "cashback", "reembolso", "ajuste a credito"];

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function agruparLinhas(itens: ItemPdf[]): LinhaPdf[] {
  const linhas: LinhaPdf[] = [];
  const ordenados = [...itens].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  for (const it of ordenados) {
    const texto = it.str.replace(/\s+/g, " ").trim();
    if (!texto) continue;
    const atual = linhas[linhas.length - 1];
    if (atual && atual.page === it.page && Math.abs(atual.y - it.y) <= 2.5) {
      atual.celulas.push({ texto, x: it.x, w: it.w });
    } else {
      linhas.push({ page: it.page, y: it.y, celulas: [{ texto, x: it.x, w: it.w }], texto: "" });
    }
  }
  for (const l of linhas) {
    l.celulas.sort((a, b) => a.x - b.x);
    l.texto = l.celulas.map((c) => c.texto).join(" ").replace(/\s+/g, " ").trim();
  }
  return linhas;
}

/** Remove cabeçalhos/rodapés: textos que se repetem em (quase) todas as páginas. */
function semRepetidas(linhas: LinhaPdf[]): LinhaPdf[] {
  const paginas = new Set(linhas.map((l) => l.page)).size;
  if (paginas < 3) return linhas;
  const cont = new Map<string, Set<number>>();
  for (const l of linhas) {
    const k = semAcento(l.texto).replace(/\d+/g, "#");
    if (!cont.has(k)) cont.set(k, new Set());
    cont.get(k)!.add(l.page);
  }
  return linhas.filter((l) => {
    const k = semAcento(l.texto).replace(/\d+/g, "#");
    const repeticoes = cont.get(k)?.size ?? 0;
    return repeticoes < Math.max(2, paginas - 1);
  });
}

function ehRuido(texto: string): boolean {
  const t = semAcento(texto);
  if (t.length < 3) return true;
  return ehLinhaResumoFatura(texto) || RUIDO.some((r) => t.includes(semAcento(r)));
}

/** Divide uma célula que veio com data/descrição/valor colados. */
function explodirCelulas(linha: LinhaPdf): Celula[] {
  const out: Celula[] = [];
  for (const c of linha.celulas) {
    const partes = c.texto.split(/\s{2,}/).filter(Boolean);
    if (partes.length <= 1) {
      out.push(c);
      continue;
    }
    let off = 0;
    const passo = c.w / Math.max(c.texto.length, 1);
    for (const p of partes) {
      const idx = c.texto.indexOf(p, off);
      out.push({ texto: p, x: c.x + Math.max(idx, 0) * passo, w: p.length * passo });
      off = Math.max(idx, 0) + p.length;
    }
  }
  return out;
}

function acharData(celulas: Celula[]): { celula: Celula; indice: number } | null {
  for (let i = 0; i < Math.min(celulas.length, 3); i++) {
    const c = celulas[i]!;
    const alvo = c.texto.trim();
    if (RE_DATA.test(alvo)) return { celula: c, indice: i };
    const m = alvo.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\b/);
    if (m) return { celula: { ...c, texto: m[1]! }, indice: i };
  }
  return null;
}

function acharValor(celulas: Celula[]): { celula: Celula; indice: number } | null {
  for (let i = celulas.length - 1; i >= 0; i--) {
    const c = celulas[i]!;
    const alvo = c.texto.trim();
    if (RE_VALOR.test(alvo) || RE_VALOR_SIMPLES.test(alvo)) return { celula: c, indice: i };
    const m = alvo.match(/(-?\(?\s*(?:R\$|US\$)?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\s*\)?-?)$/);
    if (m) return { celula: { ...c, texto: m[1]! }, indice: i };
  }
  return null;
}

export function parseDataFlexivel(raw: string, anoBase: number, mesRef?: number | null): string | null {
  const t = raw.trim().toLowerCase();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = t.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?$/);
  if (br) {
    const dia = br[1]!;
    const mes = Number(br[2]);
    if (mes < 1 || mes > 12) return null;
    let ano = br[3] ? (br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])) : anoBase;
    // Virada de ano: compra em dezembro aparece em fatura de janeiro.
    if (!br[3] && mesRef && mes === 12 && mesRef === 1) ano -= 1;
    if (!br[3] && mesRef && mes === 1 && mesRef === 12) ano += 1;
    return `${ano}-${String(mes).padStart(2, "0")}-${dia}`;
  }

  const txt = t.match(/^(\d{1,2})\s*(?:de\s*)?([a-zç]{3,9})\.?(?:\s*(?:de\s*)?(\d{2,4}))?$/i);
  if (txt) {
    const chave = semAcento(txt[2]!);
    const mes = MESES[chave] ?? MESES[chave.slice(0, 3)];
    if (!mes) return null;
    let ano = txt[3] ? (txt[3].length === 2 ? 2000 + Number(txt[3]) : Number(txt[3])) : anoBase;
    if (!txt[3] && mesRef && mes === 12 && mesRef === 1) ano -= 1;
    return `${ano}-${String(mes).padStart(2, "0")}-${txt[1]!.padStart(2, "0")}`;
  }
  return null;
}

function ehCredito(texto: string, valorBruto: string): boolean {
  const t = semAcento(texto);
  if (/^\(.*\)$/.test(valorBruto.trim())) return true;
  if (/-\s*$/.test(valorBruto) || /^\s*-/.test(valorBruto)) return true;
  return CREDITO.some((c) => t.includes(semAcento(c)));
}

export type ResultadoPosicional = {
  lancamentos: LancamentoExtraido[];
  colunas: { data?: number | undefined; valor?: number | undefined; descricao?: number | undefined };
};

/** Extrai lançamentos usando as posições das colunas; funciona para layouts desconhecidos. */
export function extrairPosicional(
  itens: ItemPdf[],
  vencimento: string | null,
  perfil?: PerfilLayout | null,
): ResultadoPosicional {
  const anoBase = vencimento ? Number(vencimento.slice(0, 4)) : new Date().getFullYear();
  const mesRef = vencimento ? Number(vencimento.slice(5, 7)) : null;
  const linhas = semRepetidas(agruparLinhas(itens));

  const out: LancamentoExtraido[] = [];
  const xData: number[] = [];
  const xValor: number[] = [];
  const xDesc: number[] = [];
  let finalAtual: string | null = null;
  let seq = 0;
  let pendente: { data: string; descricao: string; final: string | null } | null = null;
  let dentro = !perfil?.ancora_inicio;
  let secaoIgnorada = false;

  for (const linha of linhas) {
    const bruto = linha.texto;
    if (!bruto) continue;

    if (SECAO_IGNORADA.test(bruto)) {
      secaoIgnorada = true;
      pendente = null;
      continue;
    }
    if (SECAO_LANCAMENTOS.test(bruto)) {
      secaoIgnorada = false;
      pendente = null;
      continue;
    }
    if (secaoIgnorada) continue;

    if (perfil?.ancora_inicio && !dentro) {
      if (semAcento(bruto).includes(semAcento(perfil.ancora_inicio))) dentro = true;
      continue;
    }
    if (perfil?.ancora_fim && dentro && semAcento(bruto).includes(semAcento(perfil.ancora_fim))) {
      dentro = false;
      continue;
    }

    const celulas = explodirCelulas(linha);
    const mFinal = bruto.match(RE_FINAL_LINHA);
    const soCartao = mFinal && !acharValor(celulas);
    if (soCartao) {
      finalAtual = mFinal[1] ?? mFinal[2] ?? mFinal[3] ?? finalAtual;
      continue;
    }

    if (ehRuido(bruto)) {
      pendente = null;
      continue;
    }

    const data = acharData(celulas);
    const valor = acharValor(celulas);

    // Valor solto numa linha abaixo da descrição (com ou sem continuação do texto).
    if (!data && valor && pendente && celulas.length <= 3) {
      const extra = celulas
        .filter((_, i) => i !== valor.indice)
        .map((c) => c.texto)
        .join(" ")
        .trim();
      const desc = extra ? `${pendente.descricao} ${extra}`.trim() : pendente.descricao;
      const lanc = montar(pendente.data, desc, valor.celula.texto, bruto, pendente.final);
      if (lanc) {
        out.push(lanc);
        xValor.push(valor.celula.x);
      }
      pendente = null;
      continue;
    }


    if (!data) {
      // Continuação da descrição da linha anterior.
      if (pendente && !valor && bruto.length > 2 && bruto.length < 60) {
        pendente.descricao = `${pendente.descricao} ${bruto}`.trim();
      }
      continue;
    }

    const iso = parseDataFlexivel(data.celula.texto, anoBase, mesRef);
    if (!iso) continue;

    const meio = celulas
      .slice(data.indice + 1, valor ? valor.indice : celulas.length)
      .map((c) => c.texto)
      .join(" ")
      .trim();
    if (!meio) continue;

    if (perfil?.colunas?.data != null && Math.abs(data.celula.x - perfil.colunas.data) > 60) continue;
    if (valor && perfil?.colunas?.valor != null && Math.abs(valor.celula.x - perfil.colunas.valor) > 80) continue;

    if (!valor) {
      pendente = { data: iso, descricao: meio, final: finalAtual };
      continue;
    }

    const lanc = montar(iso, meio, valor.celula.texto, bruto, finalAtual);
    if (lanc) {
      out.push(lanc);
      xData.push(data.celula.x);
      xValor.push(valor.celula.x);
      xDesc.push(celulas[data.indice + 1]?.x ?? 0);
    }
    pendente = null;
  }

  function montar(
    dataIso: string,
    descBruta: string,
    valorTexto: string,
    linhaCompleta: string,
    final: string | null,
  ): LancamentoExtraido | null {
    const descricao = corrigirTexto(descBruta.replace(/\s{2,}/g, " "));
    if (!descricao || descricao.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 2) return null;
    const valor = parseValor(valorTexto);
    if (!valor) return null;
    const parc = descricao.match(RE_PARCELA);
    const numero = parc ? Number(parc[1]) : 1;
    const total = parc ? Number(parc[2]) : 1;
    const credito = ehCredito(linhaCompleta, valorTexto) || valor < 0;
    return {
      id: `p${seq++}`,
      data_compra: dataIso,
      descricao,
      descricao_normalizada: normalizarDescricao(descricao),
      valor: Math.abs(valor),
      moeda: /US\$|USD|d[oó]lar/i.test(linhaCompleta) ? "USD" : "BRL",
      direcao: credito ? "credito" : "debito",
      parcela_numero: numero > 0 && numero <= total ? numero : 1,
      parcela_total: total >= 1 && total <= 99 ? total : 1,
      cartao_final: final,
      responsavel: null,
      categoria: "outros",
      confianca_data: /\d{2}\/\d{2}\/\d{2,4}/.test(dataIso) ? "alta" : "alta",
      valor_estimado: false,
      incluir: !credito,
    };
  }

  const mediana = (v: number[]) =>
    v.length ? Number([...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!.toFixed(1)) : undefined;

  return {
    lancamentos: out,
    colunas: { data: mediana(xData), valor: mediana(xValor), descricao: mediana(xDesc) },
  };
}

/** Assinatura estável do emissor: primeiras palavras fixas do documento, sem números. */
export function assinaturaDocumento(texto: string): string {
  const base = semAcento(texto)
    .replace(/[\d.,/\-]+/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => p.length > 3)
    .slice(0, 25)
    .join(" ");
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return `${base.slice(0, 60)}#${(h >>> 0).toString(36)}`;
}

/** Confere a soma dos lançamentos contra o total declarado da fatura. */
export function conferirTotal(
  lancamentos: LancamentoExtraido[],
  totalDeclarado: number | null,
): { ok: boolean; soma: number; diferenca: number | null } {
  const soma = Number(
    lancamentos
      .reduce((s, l) => s + (l.direcao === "credito" ? -l.valor : l.valor), 0)
      .toFixed(2),
  );
  if (totalDeclarado == null) return { ok: lancamentos.length > 0, soma, diferenca: null };
  const diferenca = Number((totalDeclarado - soma).toFixed(2));
  return { ok: Math.abs(diferenca) <= Math.max(1, totalDeclarado * 0.01), soma, diferenca };
}
