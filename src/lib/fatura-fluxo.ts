/**
 * Leitor de fatura "por fluxo" (2026-10-10).
 *
 * Diferente do leitor posicional (`fatura-layout.ts`), que reordena todos os
 * fragmentos do PDF por altura e por isso mistura as duas colunas das faturas
 * Itaú/Santander numa linha só, este leitor:
 *
 * 1. Monta as linhas na ORDEM EM QUE O PRÓPRIO PDF escreve o texto (fluxo do
 *    documento). Os lançamentos saem nessa mesma ordem.
 * 2. Descobre as colunas de cada página pela posição das datas dos
 *    lançamentos e decide a seção de cada lançamento pelo título mais próximo
 *    ACIMA dele na mesma coluna. Assim "Compras parceladas - próximas
 *    faturas", "Lançamentos futuros", "Total a vencer" etc. nunca entram como
 *    gasto do mês atual, mesmo quando o PDF escreve esse bloco fora de ordem.
 * 3. Identifica o portador (titular/adicional) e o final do cartão pelos
 *    cabeçalhos "NOME - 1234 XXXX XXXX 5678", "NOME (final 1234)" ou pelo nome
 *    solto acima da tabela.
 * 4. Separa a parcela ("02/03", "DIFERENCI01/12", "- Parcela 4/6", coluna
 *    própria) do nome do estabelecimento e escolhe o valor certo quando a
 *    linha tem mais de um número (valor original x lançamento do mês, R$ x US$).
 *
 * Módulo puro (sem pdfjs), testável com as faturas reais anonimizadas.
 */
import type { LancamentoExtraido } from "@/lib/faturas";
import type { ItemPdf } from "@/lib/fatura-layout";
import { ehValorCredito } from "@/lib/lancamento-direcao";
import { identificarParcela } from "@/lib/parcela";
import {
  corrigirTexto,
  limparDescricaoComercial,
  normalizarDescricao,
  parseValor,
} from "@/lib/texto-fatura";

export type LinhaFluxo = {
  ordem: number;
  page: number;
  x: number;
  y: number;
  texto: string;
};

export type CabecalhoFatura = {
  vencimento: string | null;
  titular: string | null;
  cartao_final: string | null;
  limite_total: number | null;
  limite_disponivel: number | null;
  limite_utilizado: number | null;
  total_impresso: number | null;
};

export type ResultadoFluxo = {
  lancamentos: LancamentoExtraido[];
  portadores: Array<{ nome: string; final: string | null }>;
  finais: string[];
  ignorados: number;
};

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Linhas na ordem do fluxo do PDF: quebra quando muda a altura ou o texto volta para a esquerda. */
export function linhasPorFluxo(itens: ItemPdf[]): LinhaFluxo[] {
  const out: LinhaFluxo[] = [];
  let atual: (LinhaFluxo & { fim: number }) | null = null;
  for (const it of itens) {
    const str = it.str.replace(/\s+/g, " ").trim();
    if (!str) continue;
    const mesma =
      atual &&
      atual.page === it.page &&
      Math.abs(atual.y - it.y) <= 2.5 &&
      it.x >= atual.fim - 4;
    if (mesma && atual) {
      atual.texto = `${atual.texto} ${str}`;
      atual.fim = Math.max(atual.fim, it.x + (it.w || str.length * 4));
    } else {
      if (atual) out.push(atual);
      atual = {
        ordem: out.length,
        page: it.page,
        x: it.x,
        y: it.y,
        texto: str,
        fim: it.x + (it.w || str.length * 4),
      };
    }
  }
  if (atual) out.push(atual);
  return out.map(({ ordem, page, x, y, texto }, i) => ({
    ordem: i ?? ordem,
    page,
    x,
    y,
    texto: texto.replace(/\s+/g, " ").trim(),
  }));
}

// ---------------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------------

// Bloco de parcelas FUTURAS: nunca entra como gasto do mês, mesmo se houver
// cabeçalho de tabela ("DATA ESTABELECIMENTO VALOR") logo abaixo.
const RE_SECAO_FUTURO =
  /(pr[oó]xima?s?\s+faturas?|lan[cç]amentos\s+futuros|parcelas\s+a\s+vencer|total\s+a\s+vencer|obriga[cç][oõ]es\s+futuras|saldo\s+total\s+consolidado)/i;

// Blocos informativos (resumo, limites, encargos, simulações). Um cabeçalho de
// tabela de lançamentos abaixo deles volta a valer como lançamento.
const RE_SECAO_OUTRO =
  /(encargos\s+(cobrados|da\s+fatura|para)|fique\s+atento|simula[cç][aã]o|^limites?\s+de\s+cr[eé]dito|^resumo\s+(da|de)\b|hist[oó]rico\s+de\s+faturas|parcelamento\s+(da|de)\s+fatura|op[cç][oõ]es\s+de\s+pagamento|pagamento\s+m[ií]nimo\s+desta|protocolo\s+de\s+atendimento|programa\s+de\s+(pontos|incentivo)|juros\s+e\s+custo\s+efetivo|demais\s+taxas)/i;

const RE_SECAO_INCLUIR =
  /^(lan[cç]amentos?\s*:|lan[cç]amentos\s+(internacionais|nacionais|atuais)\b|despesas\b|parcelamentos\b|pagamentos?\s+(e\s+demais\s+cr[eé]ditos|efetuados)|hist[oó]rico\s+de\s+despesas|detalhamento\s+da\s+fatura|compras\s+e\s+saques|movimenta[cç][oõ]es\s+(da\s+fatura|nacionais|internacionais)|transa[cç][oõ]es\b)/i;

// Cabeçalho de colunas da tabela ("Data Loja Descrição", "DATA ESTABELECIMENTO VALOR EM R$").
const RE_CABECALHO_TABELA = /^(compra\s+)?data\b.*\b(descri|estabelecimento|loja|valor|hist[oó]rico)/i;

type TipoSecao = "incluir" | "futuro" | "outro" | "cabecalho";

function tipoSecao(texto: string): TipoSecao | null {
  const t = texto.trim();
  if (/^\d{2}\/\d{2}/.test(t)) return null; // linha de lançamento, não título
  if (RE_CABECALHO_TABELA.test(t)) return "cabecalho";
  // Título é curto; frases longas e notas de rodapé ("*Somatória ...") não abrem seção.
  if (t.length > 70 || /^[*(]/.test(t)) return null;
  // Linha com valor é linha de tabela/resumo, não título de seção.
  if (/\d{1,3}(?:\.\d{3})*,\d{2}/.test(t)) return null;
  if (/^(l\s+)?total\b|^subtotal\b|^lan[cç]amentos\s+no\s+cart[aã]o/i.test(t)) return null;
  if (RE_SECAO_FUTURO.test(t)) return "futuro";
  if (RE_SECAO_OUTRO.test(t)) return "outro";
  if (RE_SECAO_INCLUIR.test(t)) return "incluir";
  return null;
}

// ---------------------------------------------------------------------------
// Portadores (titular / adicionais) e final do cartão
// ---------------------------------------------------------------------------

const NOME = String.raw`([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]*){1,5})`;
const RE_PORTADOR_NUMERO = new RegExp(
  String.raw`^@?\s*${NOME}\s*-\s*\d{4}[\s.]*[x*•\d]{4}[\s.]*[x*•\d]{4}[\s.]*(\d{4})\b`,
  "i",
);
const RE_PORTADOR_FINAL = new RegExp(String.raw`^@?\s*${NOME}\s*\(\s*final\s*(\d{4})\s*\)\s*$`, "i");
const RE_NOME_SOLTO = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]*){1,5}$/;
const PALAVRAS_NAO_NOME =
  /\b(lan[cç]amentos?|data|valor|total|fatura|compras?|pagamentos?|despesas|resumo|limite|cart[aã]o|parcel|encargos|juros|saldo|servi[cç]os|produtos|internacionais|estabelecimento|descri[cç][aã]o|continua|vencimento|banco|central|atendimento|ouvidoria|aten[cç][aã]o|importante|titular|benefici|pagador|endere[cç]o)\b/i;

const RE_CARTAO_MASCARA = /(?:\d{4}[\s.]?)?(?:[x*•]{2,}[\s.]?){1,3}(\d{3,4})\b/gi;

export function extrairFinaisCartao(texto: string): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(RE_CARTAO_MASCARA)) out.add(m[1]!);
  for (const m of texto.matchAll(/\bfinal\s*(?:com\s*)?(\d{4})\b/gi)) out.add(m[1]!);
  return Array.from(out);
}

/** "MATHEUS B OLIVEIRA" -> "Matheus B Oliveira". */
export function nomeLegivel(nome: string): string {
  return nome
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((p) =>
      ["de", "da", "do", "dos", "das", "e"].includes(p)
        ? p
        : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1),
    )
    .join(" ");
}

/** Mesma pessoa? Compara primeiro e último nome, sem acento (aceita abreviações no meio). */
export function mesmaPessoa(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = semAcento(a).replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
  const pb = semAcento(b).replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
  if (!pa.length || !pb.length || pa[0] !== pb[0]) return false;
  if (pa.length === 1 || pb.length === 1) return true;
  const ua = pa[pa.length - 1]!;
  const ub = pb[pb.length - 1]!;
  return ua === ub || ua.startsWith(ub) || ub.startsWith(ua);
}

type Portador = { nome: string; final: string | null };

function portadorDaLinha(l: LinhaFluxo, proxima: LinhaFluxo | undefined): Portador | null {
  const t = l.texto.trim();
  const a = t.match(RE_PORTADOR_NUMERO);
  if (a) return { nome: nomeLegivel(a[1]!), final: a[2]! };
  const b = t.match(RE_PORTADOR_FINAL);
  if (b) return { nome: nomeLegivel(b[1]!), final: b[2]! };
  if (
    RE_NOME_SOLTO.test(t) &&
    !PALAVRAS_NAO_NOME.test(t) &&
    t.split(" ").length >= 2 &&
    proxima &&
    /^data\b/i.test(proxima.texto.trim())
  ) {
    return { nome: nomeLegivel(t), final: null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cabeçalho (vencimento, titular, cartão, limites, total)
// ---------------------------------------------------------------------------

const DINHEIRO = String.raw`R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})`;

function primeiroDinheiroDepois(texto: string, re: RegExp, janela = 160): number | null {
  const m = re.exec(texto);
  if (!m) return null;
  const trecho = texto.slice(m.index + m[0].length, m.index + m[0].length + janela);
  const v = trecho.match(new RegExp(DINHEIRO));
  return v ? parseValor(v[1]!) : null;
}

/** Texto "achatado" na ordem do PDF, com " | " entre fragmentos (rótulo e valor ficam próximos). */
export function textoFluxo(itens: ItemPdf[]): string {
  return itens
    .map((i) => i.str.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" | ");
}

export function extrairCabecalhoFatura(itens: ItemPdf[]): CabecalhoFatura {
  const t = textoFluxo(itens);
  const venc = t.match(/vencimento(?:\s+em)?\s*:?\s*(?:\|\s*)?(\d{2})\/(\d{2})\/(\d{4})/i);
  const vencimento = venc ? `${venc[3]}-${venc[2]}-${venc[1]}` : null;

  const tit = t.match(/titular\s*:?\s*\|?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{4,60}?)\s*(?:\||$)/i);
  const titular =
    tit && tit[1]!.trim().split(/\s+/).length >= 2 && !PALAVRAS_NAO_NOME.test(tit[1]!)
      ? nomeLegivel(tit[1]!)
      : null;

  let cartao_final: string | null = null;
  const cart = t.match(/cart[aã]o\s*:?\s*\|?\s*((?:\d{4}[\s.]?)?(?:[x*•]{2,}[\s.]?){1,3}(\d{3,4}))\b/i);
  if (cart) cartao_final = cart[2]!;
  if (!cartao_final) {
    const tn = t.match(/titular\s*\|?\s*(\d{4})\b/i);
    if (tn) cartao_final = tn[1]!;
  }

  const limite_total =
    primeiroDinheiroDepois(t, /limite\s+total\s+de\s+cr[eé]dito/i) ??
    primeiroDinheiroDepois(t, /seu\s+limite\s+[eé]/i) ??
    primeiroDinheiroDepois(t, /limite\s+para\s+compras?[^|]*\|\s*total/i, 40);
  const limite_disponivel =
    primeiroDinheiroDepois(t, /limite\s+dispon[ií]vel(?!\s+para\s+compras\s+em)/i, 60) ??
    primeiroDinheiroDepois(t, /\|\s*dispon[ií]vel\s*\|/i, 30);
  const limite_utilizado =
    primeiroDinheiroDepois(t, /limite\s+(?:total\s+)?utilizado(?!\s+no\s+m[eê]s)/i, 60) ??
    (limite_total != null && limite_disponivel != null
      ? Number((limite_total - limite_disponivel).toFixed(2))
      : null);

  const total_impresso =
    primeiroDinheiroDepois(t, /total\s+desta\s+fatura/i, 40) ??
    primeiroDinheiroDepois(t, /saldo\s+desta\s+fatura/i, 40) ??
    primeiroDinheiroDepois(t, /valor\s+total\s+devido/i, 40) ??
    primeiroDinheiroDepois(t, /total\s+a\s+pagar/i, 40) ??
    primeiroDinheiroDepois(t, /saldo\s+[aà]\s+pagar/i, 40);

  return {
    vencimento,
    titular,
    cartao_final,
    limite_total,
    limite_disponivel,
    limite_utilizado,
    total_impresso,
  };
}

// ---------------------------------------------------------------------------
// Linha de lançamento
// ---------------------------------------------------------------------------

const RE_DATA_INICIO = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+/;
const RE_DINHEIRO_G =
  /(?:([+-])\s+)?(-?\s?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2})(\s?[+-](?=\s|$))?/g;

type LinhaLancamento = {
  dia: number;
  mes: number;
  ano: number | null;
  descricao: string;
  valorTexto: string;
  parcela: { atual: number; total: number } | null;
  linha: string;
};

function validaParcela(a: number, t: number) {
  return a >= 1 && t >= 2 && a <= t && t <= 99;
}

/** Tira a parcela do fim da descrição: "PRE 01/07", "DIFERENCI01/12", "- Parcela 4/6", "PARC 2 DE 5". */
export function separarParcela(descricao: string): {
  descricao: string;
  parcela: { atual: number; total: number } | null;
} {
  const d = descricao.trim();
  const padroes: RegExp[] = [
    /\s*[-–]?\s*parc(?:ela)?\.?\s*n?[ºo°]?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i,
    /\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*$/,
    /(?<=[A-Za-zÀ-ÿ*])(\d{2})\/(\d{2})\s*$/,
  ];
  for (const re of padroes) {
    const m = d.match(re);
    if (!m) continue;
    const a = Number(m[1]);
    const t = Number(m[2]);
    if (!validaParcela(a, t)) continue;
    return { descricao: d.slice(0, m.index).trim().replace(/[-–]\s*$/, "").trim(), parcela: { atual: a, total: t } };
  }
  if (/\bparc/i.test(d)) {
    const p = identificarParcela(d);
    if (p) return { descricao: limparDescricaoComercial(d), parcela: p };
  }
  return { descricao: d, parcela: null };
}

export function lerLinhaLancamento(
  texto: string,
  opcoes: { codigoLoja?: boolean } = {},
): LinhaLancamento | null {
  let t = texto.trim();
  // Nota de rodapé numérica antes da data (Santander: "1 29/06 UNIDAS ...").
  t = t.replace(/^\d{1,2}\s+(?=\d{2}\/\d{2}\b)/, "");
  const md = t.match(RE_DATA_INICIO);
  if (!md) return null;
  const dia = Number(md[1]);
  const mes = Number(md[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  const ano = md[3] ? (md[3].length === 2 ? 2000 + Number(md[3]) : Number(md[3])) : null;
  let resto = t.slice(md[0].length);
  // Intervalos ("09/07/26 a 10/08/26", "15/08 - 14/09") não são lançamentos.
  if (/^(a|at[eé]|-)\s+\d{2}\/\d{2}/i.test(resto)) return null;
  if (opcoes.codigoLoja) resto = resto.replace(/^\d{3}\s+(?=\S)/, "");

  const tokens = Array.from(resto.matchAll(RE_DINHEIRO_G)).map((m) => ({
    inicio: m.index!,
    fim: m.index! + m[0].length,
    sinalAntes: m[1] ?? null,
    numero: m[2]!.replace(/\s/g, ""),
    sinalDepois: m[3]?.trim() ?? null,
  }));
  if (!tokens.length) return null;

  const comSinal = tokens.filter((k) => k.sinalAntes || k.sinalDepois);
  const escolhido = comSinal.length ? comSinal[comSinal.length - 1]! : tokens[0]!;
  const valorTexto = `${escolhido.sinalAntes === "-" ? "-" : ""}${escolhido.numero}${
    escolhido.sinalDepois ?? ""
  }`;

  const descBruta = resto.slice(0, tokens[0]!.inicio).trim();
  if (!descBruta || descBruta.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 2) return null;
  // Parcela numa coluna própria entre dois valores (Midway/Riachuelo: "429,96 02/03 + 143,32").
  const meio = resto.slice(tokens[0]!.fim, escolhido.inicio);
  const pMeio = meio.match(/\b(\d{1,2})\/(\d{1,2})\b/);

  const sep = separarParcela(descBruta);
  let parcela = sep.parcela;
  if (!parcela && pMeio && validaParcela(Number(pMeio[1]), Number(pMeio[2]))) {
    parcela = { atual: Number(pMeio[1]), total: Number(pMeio[2]) };
  }
  return { dia, mes, ano, descricao: sep.descricao, valorTexto, parcela, linha: t };
}

function anoDaCompra(mes: number, ano: number | null, vencimento: string | null): number {
  if (ano) return ano;
  if (!vencimento) return new Date().getFullYear();
  const av = Number(vencimento.slice(0, 4));
  const mv = Number(vencimento.slice(5, 7));
  // Compra num mês "depois" do vencimento só pode ser do ano anterior
  // (ex.: fatura de out/2026 com parcela de compra feita em 28/11 -> 2025).
  return mes > mv ? av - 1 : av;
}

// ---------------------------------------------------------------------------
// Colunas por página
// ---------------------------------------------------------------------------

function colunasDaPagina(xs: number[]): number[] {
  const ord = Array.from(new Set(xs.map((x) => Math.round(x)))).sort((a, b) => a - b);
  const inicios: number[] = [];
  for (const x of ord) {
    if (!inicios.length || x - inicios[inicios.length - 1]! > 120) inicios.push(x);
  }
  return inicios;
}

function colunaDe(x: number, inicios: number[]): number {
  let c = 0;
  for (let i = 0; i < inicios.length; i++) if (x >= inicios[i]! - 60) c = i;
  return c;
}

// ---------------------------------------------------------------------------
// Leitura principal
// ---------------------------------------------------------------------------

export function extrairPorFluxo(itens: ItemPdf[], vencimentoInformado?: string | null): ResultadoFluxo {
  const linhas = linhasPorFluxo(itens);
  const cab = extrairCabecalhoFatura(itens);
  const vencimento = vencimentoInformado ?? cab.vencimento;
  const codigoLoja = linhas.some((l) => /\bdata\b.*\bloja\b.*\bdescri/i.test(l.texto));

  type Candidata = { linha: LinhaFluxo; lida: LinhaLancamento; coluna: number };
  const candidatas: Candidata[] = [];
  const titulos: Array<{ linha: LinhaFluxo; tipo: TipoSecao; coluna: number }> = [];
  const portadores: Array<{ linha: LinhaFluxo; p: Portador; coluna: number }> = [];

  // Junta "data + descrição" com o valor que o PDF escreveu logo em seguida na mesma altura.
  const usadas = new Set<number>();
  const lidas: Array<{ linha: LinhaFluxo; lida: LinhaLancamento }> = [];
  for (let i = 0; i < linhas.length; i++) {
    if (usadas.has(i)) continue;
    const l = linhas[i]!;
    let lida = lerLinhaLancamento(l.texto, { codigoLoja });
    if (!lida && RE_DATA_INICIO.test(l.texto.replace(/^\d{1,2}\s+(?=\d{2}\/\d{2}\b)/, ""))) {
      const prox = linhas[i + 1];
      if (prox && prox.page === l.page && Math.abs(prox.y - l.y) <= 3 && prox.x > l.x) {
        lida = lerLinhaLancamento(`${l.texto} ${prox.texto}`, { codigoLoja });
        if (lida) usadas.add(i + 1);
      }
    }
    if (lida) lidas.push({ linha: l, lida });
  }

  const xsPorPagina = new Map<number, number[]>();
  for (const { linha } of lidas) {
    if (!xsPorPagina.has(linha.page)) xsPorPagina.set(linha.page, []);
    xsPorPagina.get(linha.page)!.push(linha.x);
  }
  const colunas = new Map<number, number[]>();
  for (const [p, xs] of xsPorPagina) colunas.set(p, colunasDaPagina(xs));
  const col = (l: LinhaFluxo) => colunaDe(l.x, colunas.get(l.page) ?? [l.x]);

  for (const { linha, lida } of lidas) candidatas.push({ linha, lida, coluna: col(linha) });
  linhas.forEach((l, i) => {
    const tipo = tipoSecao(l.texto);
    if (tipo) titulos.push({ linha: l, tipo, coluna: col(l) });
    const p = portadorDaLinha(l, linhas[i + 1]);
    if (p) portadores.push({ linha: l, p, coluna: col(l) });
  });

  function maisProximoAcima<T extends { linha: LinhaFluxo; coluna: number }>(
    lista: T[],
    alvo: Candidata,
  ): T | null {
    let melhor: T | null = null;
    for (const h of lista) {
      if (h.linha.page !== alvo.linha.page) continue;
      // Mesma coluna: o título/portador começa perto da data do lançamento
      // (até 80pt à esquerda ou 150pt à direita). Evita que um bloco da
      // coluna vizinha (ex.: "Simulação... próximo período") governe a linha.
      const dx = h.linha.x - alvo.linha.x;
      if (dx < -80 || dx > 150) continue;
      if (h.linha.y <= alvo.linha.y) continue;
      if (!melhor || h.linha.y < melhor.linha.y) melhor = h;
    }
    return melhor;
  }

  const titularPadrao: Portador | null = cab.titular
    ? { nome: cab.titular, final: cab.cartao_final }
    : null;
  const finalDoPortador = (p: Portador | null): string | null => {
    if (!p) return cab.cartao_final;
    if (p.final) return p.final;
    return titularPadrao && mesmaPessoa(p.nome, titularPadrao.nome) ? cab.cartao_final : null;
  };

  const out: LancamentoExtraido[] = [];
  let secaoAnterior: "incluir" | "ignorar" = "incluir";

  /** Sobe a partir do lançamento: cabeçalho de tabela só herda se o título acima for de parcelas futuras. */
  function secaoDoLancamento(c: Candidata): "incluir" | "ignorar" | null {
    const acima = titulos
      .filter((h) => {
        if (h.linha.page !== c.linha.page || h.linha.y <= c.linha.y) return false;
        const dx = h.linha.x - c.linha.x;
        return dx >= -80 && dx <= 150;
      })
      .sort((a, b) => a.linha.y - b.linha.y);
    const primeiro = acima[0];
    if (!primeiro) return null;
    if (primeiro.tipo === "incluir") return "incluir";
    if (primeiro.tipo === "futuro" || primeiro.tipo === "outro") return "ignorar";
    const titulo = acima.find((h) => h.tipo !== "cabecalho");
    return titulo?.tipo === "futuro" ? "ignorar" : "incluir";
  }
  let portadorAnterior: Portador | null = titularPadrao;
  let ignorados = 0;
  let seq = 0;
  let ultimaDataIncluida: string | null = null;

  for (const c of candidatas) {
    const secao: "incluir" | "ignorar" = secaoDoLancamento(c) ?? secaoAnterior;
    secaoAnterior = secao;
    const port = maisProximoAcima(portadores, c)?.p ?? portadorAnterior;
    portadorAnterior = port;
    if (secao === "ignorar") {
      ignorados++;
      continue;
    }
    const { lida } = c;
    const ano = anoDaCompra(lida.mes, lida.ano, vencimento);
    const dataIso = `${ano}-${String(lida.mes).padStart(2, "0")}-${String(lida.dia).padStart(2, "0")}`;
    const valor = parseValor(lida.valorTexto);
    if (!valor) continue;
    const descricao = limparDescricaoComercial(corrigirTexto(lida.descricao));
    const credito = ehValorCredito(lida.valorTexto, lida.descricao);
    const final = finalDoPortador(port);
    out.push({
      id: `f${seq++}`,
      data_compra: dataIso,
      descricao,
      descricao_normalizada: normalizarDescricao(descricao),
      valor: Math.abs(valor),
      moeda: "BRL",
      direcao: credito ? "credito" : "debito",
      parcela_numero: lida.parcela?.atual ?? 1,
      parcela_total: lida.parcela?.total ?? 1,
      cartao_final: final,
      responsavel: port?.nome ?? null,
      categoria: "outros",
      confianca_data: lida.ano ? "alta" : "media",
      valor_estimado: false,
      incluir: !credito,
    });
    ultimaDataIncluida = dataIso;
  }

  // IOF de compra internacional vem numa linha de totalizador ("Repasse de IOF em R$ 0,98").
  for (const l of linhas) {
    const m = l.texto.match(/repasse\s+de\s+iof[^0-9]*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
    if (!m) continue;
    const valor = parseValor(m[1]!);
    if (!valor) continue;
    const port = maisProximoAcima(portadores, { linha: l, lida: null as never, coluna: col(l) })?.p ?? titularPadrao;
    out.push({
      id: `f${seq++}`,
      data_compra: ultimaDataIncluida ?? (vencimento ?? new Date().toISOString().slice(0, 10)),
      descricao: "IOF de compra internacional",
      descricao_normalizada: normalizarDescricao("IOF de compra internacional"),
      valor,
      moeda: "BRL",
      direcao: "debito",
      parcela_numero: 1,
      parcela_total: 1,
      cartao_final: finalDoPortador(port),
      responsavel: port?.nome ?? null,
      categoria: "outros",
      confianca_data: "media",
      valor_estimado: false,
      incluir: true,
    });
  }

  const nomes = new Map<string, Portador>();
  if (titularPadrao) nomes.set(semAcento(titularPadrao.nome), titularPadrao);
  for (const { p } of portadores) {
    const chave = semAcento(p.nome);
    const existente = Array.from(nomes.values()).find(
      (x) => mesmaPessoa(x.nome, p.nome) && (x.final === p.final || !x.final || !p.final),
    );
    if (existente) {
      if (!existente.final && p.final) existente.final = p.final;
      continue;
    }
    nomes.set(`${chave}#${p.final ?? ""}`, { ...p });
  }

  const finais = new Set<string>();
  for (const l of out) if (l.cartao_final) finais.add(l.cartao_final);
  if (cab.cartao_final) finais.add(cab.cartao_final);

  return {
    lancamentos: out,
    portadores: Array.from(nomes.values()),
    finais: Array.from(finais),
    ignorados,
  };
}
