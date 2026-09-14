/**
 * Leitor posicional de faturas: em vez de depender do layout de cada banco,
 * usa as coordenadas dos fragmentos do PDF para descobrir onde estão data,
 * descrição e valor.
 */
import type { LancamentoExtraido } from "@/lib/faturas";
import { ehLinhaResumoFatura } from "@/lib/fatura-metadados";
import { ehValorCredito } from "@/lib/lancamento-direcao";
import { identificarParcela } from "@/lib/parcela";
import { corrigirTexto, normalizarDescricao, parseValor } from "@/lib/texto-fatura";

export type ItemPdf = { str: string; x: number; y: number; w: number; page: number };

export type Celula = { texto: string; x: number; w: number };
export type LinhaPdf = { page: number; y: number; celulas: Celula[]; texto: string };

export type PerfilLayout = {
  assinatura: string;
  banco?: string | null;
  colunas: {
    data?: number | undefined;
    valor?: number | undefined;
    descricao?: number | undefined;
  };
  formato_data?: string | null;
  formato_valor?: string | null;
  ancora_inicio?: string | null;
  ancora_fim?: string | null;
};

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
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const RE_DATA =
  /^(\d{2}\/\d{2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\s*(?:de\s*)?[a-zç]{3,9}\.?(?:\s*(?:de\s*)?\d{2,4})?)$/i;
// O valor pode terminar em "-" (despesa comum) ou "+" (crédito/estorno) em
// notação D/C de alguns emissores — ver lancamento-direcao.ts.
const RE_VALOR = /^-?\(?\s*(?:R\$|US\$|USD|BRL)?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\s*\)?[+-]?$/i;
const RE_VALOR_SIMPLES = /^-?\(?\s*(?:R\$|US\$|USD)?\s*-?\d+[.,]\d{2}\s*\)?[+-]?$/i;
const RE_FINAL_LINHA =
  /(?:final|cart[aã]o|com\s+final)\D{0,12}(\d{4})\b|\*{2,4}\s?(\d{4})|x{4}\s?(\d{4})/i;

/** Linhas que nunca são um gasto, em qualquer banco. */
const RUIDO = [
  "pagamento minimo",
  "pagamento mínimo",
  "total a pagar",
  "total da fatura",
  "valor total",
  "saldo anterior",
  "fatura anterior",
  "cet",
  "iof previsto",
  "limite",
  "proximas faturas",
  "próximas faturas",
  "resumo",
  "vencimento",
  "atendimento",
  "ouvidoria",
  "sac",
  "central de",
  "www.",
  "cnpj",
  "pagina",
  "página",
  "demonstrativo",
  "parcelamento da fatura",
  "programa de pontos",
  "pontos acumulados",
  "valor do documento",
  "codigo de barras",
  "código de barras",
  "linha digitavel",
  "linha digitável",
  "boleto",
  "oferta",
  "contrate",
  "aproveite",
  "saldo futuro",
];

const SECAO_IGNORADA =
  /^(pr[oó]ximas faturas|saldo futuro|lan[cç]amentos futuros|ofertas?|benef[ií]cios|boleto|demonstrativo de limites?)\b/i;
const SECAO_LANCAMENTOS =
  /^(compras?|despesas?|lan[cç]amentos?|movimenta[cç][aã]o|pagamentos?(?: e demais cr[eé]ditos)?|cr[eé]ditos?|estornos?)\b/i;

function semAcento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
    l.texto = l.celulas
      .map((c) => c.texto)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
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

// Data solta no início de uma célula — mas não quando ela é, na verdade, o
// começo de um intervalo tipo "15/08 - 14/09" (cabeçalho de período de
// tabela de encargos/juros que às vezes gruda na mesma linha): esse não é
// case de transação nenhuma, é só coincidência de formato.
const RE_DATA_PREFIXO = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\b(?!\s*-\s*\d{1,2}\/\d{1,2})/;

function acharData(celulas: Celula[]): { celula: Celula; indice: number } | null {
  for (let i = 0; i < Math.min(celulas.length, 3); i++) {
    const c = celulas[i]!;
    const alvo = c.texto.trim();
    if (RE_DATA.test(alvo)) return { celula: c, indice: i };
    const m = alvo.match(RE_DATA_PREFIXO);
    if (m) return { celula: { ...c, texto: m[1]! }, indice: i };
  }
  return null;
}

function acharValor(celulas: Celula[]): { celula: Celula; indice: number } | null {
  for (let i = celulas.length - 1; i >= 0; i--) {
    const c = celulas[i]!;
    const alvo = c.texto.trim();
    if (RE_VALOR.test(alvo) || RE_VALOR_SIMPLES.test(alvo)) return { celula: c, indice: i };
    const m = alvo.match(/(-?\(?\s*(?:R\$|US\$)?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\s*\)?[+-]?)$/);
    if (m) return { celula: { ...c, texto: m[1]! }, indice: i };
  }
  return null;
}

/**
 * Como acharData, mas sem se limitar às 3 primeiras células: procura, de trás
 * pra frente a partir do valor, a data mais próxima dele.
 *
 * Usada só para "resgatar" transações reais coladas atrás de texto de outra
 * coluna do PDF (ver `agruparLinhas`/PDFs em duas colunas): nesse caso a data
 * de verdade não está mais nas 3 primeiras células porque algo foi colado na
 * frente, mas ainda está logo antes do valor da própria transação.
 */
function acharDataProxima(
  celulas: Celula[],
  antesDe: number,
): { celula: Celula; indice: number } | null {
  for (let i = antesDe - 1; i >= 0; i--) {
    const c = celulas[i]!;
    const alvo = c.texto.trim();
    if (RE_DATA.test(alvo)) return { celula: c, indice: i };
    const m = alvo.match(RE_DATA_PREFIXO);
    if (m) return { celula: { ...c, texto: m[1]! }, indice: i };
  }
  return null;
}

/**
 * Detecta duas (ou mais) transações reais e independentes grudadas na mesma
 * linha impressa — layout comum em faturas que imprimem a tabela em duas
 * colunas lado a lado (ver comentário de uso em `extrairPosicional`).
 *
 * Só reconhece o padrão quando as datas e valores aparecem em pares
 * perfeitamente alternados (data, ..., valor, data, ..., valor, ...) — uma
 * data fora de ordem, ou contagens diferentes de data/valor, faz a função
 * devolver `[]` e deixar a linha para o fluxo normal (de uma transação só),
 * que é o caso disparadamente mais comum.
 */
function dividirTransacoesDaLinha(
  celulas: Celula[],
): Array<{ data: Celula; meio: Celula[]; valor: Celula }> {
  const datas: number[] = [];
  const valores: number[] = [];
  celulas.forEach((c, i) => {
    const t = c.texto.trim();
    if (RE_DATA.test(t)) datas.push(i);
    if (RE_VALOR.test(t) || RE_VALOR_SIMPLES.test(t)) valores.push(i);
  });
  if (datas.length < 2 || datas.length !== valores.length) return [];

  const segmentos: Array<{ data: Celula; meio: Celula[]; valor: Celula }> = [];
  for (let k = 0; k < datas.length; k++) {
    const di = datas[k]!;
    const vi = valores[k]!;
    if (vi <= di) return [];
    if (k > 0 && di <= valores[k - 1]!) return [];
    segmentos.push({ data: celulas[di]!, meio: celulas.slice(di + 1, vi), valor: celulas[vi]! });
  }
  return segmentos;
}

export function parseDataFlexivel(
  raw: string,
  anoBase: number,
  mesRef?: number | null,
): string | null {
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

export type ResultadoPosicional = {
  lancamentos: LancamentoExtraido[];
  colunas: {
    data?: number | undefined;
    valor?: number | undefined;
    descricao?: number | undefined;
  };
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

  const mediana = (v: number[]) =>
    v.length
      ? Number([...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!.toFixed(1))
      : undefined;

  // Variante do problema das duas colunas em que a própria data acaba numa
  // "linha" agrupada separada da descrição+valor (baseline do número um
  // pouco diferente do resto do texto, ficando a mais de 2.5pt de distância
  // em y). Nesse caso a linha com o conteúdo real chega primeiro sem nenhuma
  // data própria — se, descontado o texto de outra coluna colado na frente
  // (usando como âncora a posição x onde a descrição normalmente começa
  // neste documento, já aprendida a partir dos lançamentos já processados),
  // sobrar uma descrição+valor plausível, guarda como pendente para ser
  // completada pela data solta que costuma vir na linha seguinte.
  let pendenteSemData: {
    descricao: string;
    valorTexto: string;
    final: string | null;
    linhaCompleta: string;
  } | null = null;

  function tentarResgatarSemColuna(
    celulas: Celula[],
    valor: { celula: Celula; indice: number },
  ): { descricao: string; valorTexto: string; linhaCompleta: string } | null {
    const limiar = (mediana(xDesc) ?? mediana(xData)) as number | undefined;
    if (limiar == null) return null;
    const relevantes = celulas.slice(0, valor.indice + 1).filter((c) => c.x >= limiar - 20);
    if (relevantes.length < 2 || relevantes.length >= celulas.length) return null;
    const descricao = relevantes
      .slice(0, -1)
      .map((c) => c.texto)
      .join(" ")
      .trim();
    if (!descricao || ehRuido(descricao)) return null;
    return {
      descricao,
      valorTexto: valor.celula.texto,
      linhaCompleta: relevantes.map((c) => c.texto).join(" "),
    };
  }

  for (const linha of linhas) {
    const bruto = linha.texto;
    if (!bruto) continue;

    // PDFs em duas colunas (ex.: painel de limites à esquerda + tabela de
    // lançamentos à direita) fazem o `agruparLinhas` colar, numa mesma
    // "linha", texto de coluna nenhuma relação com o outro só porque calhou
    // de ter o mesmo Y. Isso gera linhas tipo "Limite Rotativo R$ 11.200,00
    // 21/01/2026 LOJA X 27,59-" ou "Saldo Futuro a Vencer R$ 1.414,06
    // 31/07/2026 LOJA Y 40,00-": um trecho de resumo/seção colado na frente
    // de uma transação de verdade. Sem tratar isso, o trecho colado faz a
    // linha inteira ser descartada como ruído (`ehRuido`) ou, pior, entrar
    // num modo de "seção ignorada" que é permanente e derruba todo o resto
    // do documento.
    //
    // `transacaoEmbutida` procura, olhando de trás pra frente a partir do
    // valor, uma transação plausível colada no fim da linha — mas só
    // "resgata" a linha se o trecho ENTRE a data resgatada e o valor (ou
    // seja, a descrição de verdade da transação) não tiver, ele mesmo,
    // termos de ruído/resumo. Isso evita resgatar por engano uma linha que
    // é puramente um resumo (ex.: "Vencimento 15/08/2026 Valor Total R$
    // 1.234,56", onde "Valor Total" também é ruído) — só linhas onde o lixo
    // está genuinamente restrito ao trecho ANTES da data são resgatadas.
    const celulas = explodirCelulas(linha);
    const valorAntecipado = acharValor(celulas);

    // Antes de mais nada: essa linha é só a data solta que estávamos
    // esperando para completar um `pendenteSemData` da linha anterior?
    if (pendenteSemData && !valorAntecipado) {
      const dataSolta = acharData(celulas);
      const resto = celulas
        .filter((_, i) => i !== dataSolta?.indice)
        .map((c) => c.texto)
        .join(" ")
        .trim();
      if (dataSolta && !resto) {
        const iso = parseDataFlexivel(dataSolta.celula.texto, anoBase, mesRef);
        const pend = pendenteSemData;
        pendenteSemData = null;
        if (iso) {
          const lanc = montar(iso, pend.descricao, pend.valorTexto, pend.linhaCompleta, finalAtual);
          if (lanc) out.push(lanc);
        }
        continue;
      }
      // Não era a data esperada — descarta o pendente em vez de arriscar
      // grudar num lançamento errado.
      pendenteSemData = null;
    }
    const dataResgatada = valorAntecipado
      ? acharDataProxima(celulas, valorAntecipado.indice)
      : null;
    const meioResgatado =
      dataResgatada && valorAntecipado
        ? celulas
            .slice(dataResgatada.indice + 1, valorAntecipado.indice)
            .map((c) => c.texto)
            .join(" ")
            .trim()
        : "";
    const transacaoEmbutida =
      dataResgatada &&
      valorAntecipado &&
      dataResgatada.indice < valorAntecipado.indice &&
      !ehRuido(meioResgatado)
        ? { data: dataResgatada, valor: valorAntecipado }
        : null;

    if (SECAO_IGNORADA.test(bruto)) {
      if (!transacaoEmbutida) {
        const resgate = valorAntecipado ? tentarResgatarSemColuna(celulas, valorAntecipado) : null;
        if (resgate) {
          pendenteSemData = { ...resgate, final: finalAtual };
          pendente = null;
          continue;
        }
        secaoIgnorada = true;
        pendente = null;
        continue;
      }
      // Linha mesclada: o gatilho de "seção ignorada" veio só do texto colado
      // antes da transação real — não entra em modo ignorado por causa disso,
      // processa a transação normalmente mais abaixo.
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

    // Alguns bancos (ex.: Itaú) imprimem DUAS transações reais e
    // independentes lado a lado na mesma linha impressa, pra economizar
    // espaço vertical — não é o mesmo bug de "coluna estranha colada", são
    // duas transações de verdade mesmo. Sem tratar isso, `agruparLinhas`
    // gruda as duas na mesma linha e o restante do código só enxerga a
    // primeira data e o último valor, produzindo uma descrição só com as
    // duas descrições e valores do meio grudados (ex.: "PAG*RiotGameSa
    // 02/03 44,30 14/08 DROGARIA SAO PAULO 447S"). Se a linha tiver duas ou
    // mais datas e o mesmo número de valores, bem-comportados e alternados,
    // trata cada par como um lançamento separado.
    const transacoesDaLinha = dividirTransacoesDaLinha(celulas);
    if (transacoesDaLinha.length >= 2) {
      for (const seg of transacoesDaLinha) {
        const iso = parseDataFlexivel(seg.data.texto, anoBase, mesRef);
        if (!iso) continue;
        const meioTexto = seg.meio
          .map((c) => c.texto)
          .join(" ")
          .trim();
        if (!meioTexto) continue;
        const linhaSegmento = `${seg.data.texto} ${meioTexto} ${seg.valor.texto}`;
        const lanc = montar(iso, meioTexto, seg.valor.texto, linhaSegmento, finalAtual);
        if (lanc) {
          out.push(lanc);
          xData.push(seg.data.x);
          xValor.push(seg.valor.x);
          xDesc.push(seg.meio[0]?.x ?? 0);
        }
      }
      pendente = null;
      continue;
    }

    const mFinal = bruto.match(RE_FINAL_LINHA);
    const soCartao = mFinal && !acharValor(celulas);
    if (soCartao) {
      finalAtual = mFinal[1] ?? mFinal[2] ?? mFinal[3] ?? finalAtual;
      continue;
    }

    if (ehRuido(bruto) && !transacaoEmbutida) {
      const resgate = valorAntecipado ? tentarResgatarSemColuna(celulas, valorAntecipado) : null;
      if (resgate) {
        pendenteSemData = { ...resgate, final: finalAtual };
        pendente = null;
        continue;
      }
      pendente = null;
      continue;
    }

    const data = acharData(celulas) ?? (transacaoEmbutida ? transacaoEmbutida.data : null);
    const valor = valorAntecipado;

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

    if (perfil?.colunas?.data != null && Math.abs(data.celula.x - perfil.colunas.data) > 60)
      continue;
    if (
      valor &&
      perfil?.colunas?.valor != null &&
      Math.abs(valor.celula.x - perfil.colunas.valor) > 80
    )
      continue;

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
    const parc = identificarParcela(descricao);
    const numero = parc?.atual ?? 1;
    const total = parc?.total ?? 1;
    const credito = ehValorCredito(valorTexto, linhaCompleta);
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

  return {
    lancamentos: out,
    colunas: { data: mediana(xData), valor: mediana(xValor), descricao: mediana(xDesc) },
  };
}

/** Assinatura estável do emissor: primeiras palavras fixas do documento, sem números. */
export function assinaturaDocumento(texto: string): string {
  const base = semAcento(texto)
    .replace(/[\d.,/-]+/g, " ")
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
    lancamentos.reduce((s, l) => s + (l.direcao === "credito" ? -l.valor : l.valor), 0).toFixed(2),
  );
  if (totalDeclarado == null) return { ok: lancamentos.length > 0, soma, diferenca: null };
  const diferenca = Number((totalDeclarado - soma).toFixed(2));
  return { ok: Math.abs(diferenca) <= Math.max(1, totalDeclarado * 0.01), soma, diferenca };
}
