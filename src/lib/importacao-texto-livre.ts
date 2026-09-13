/**
 * Etapa 4 — Caixa de texto livre independente da ordem.
 *
 * Interpreta lançamentos digitados ou colados manualmente (fora do fluxo de
 * PDF), um por linha, onde data, descrição, valor, parcela e cartão podem
 * aparecer em qualquer ordem e separados por vírgula, ponto e vírgula ou só
 * espaço. Produz o mesmo modelo da Etapa 1 (`LancamentoImportadoCompleto`),
 * reaproveitando os extratores puros já testados de `importacao-modelo.ts`
 * (`lerValorMonetario`, `extrairParcelaSegura`, `extrairFinalCartaoSeguro`,
 * `classificarTipoSemantico`) em vez de recriá-los.
 *
 * Estratégia para não confundir campos entre si: data e fração de parcela
 * usam a mesma forma "X/Y", então a ordem de leitura importa. Primeiro
 * procuramos só parcelas ANCORADAS por palavra-chave ("parc 2/3", "01 de
 * 03") — inequívocas, nunca colidem com data — e apagamos esse trecho.
 * Só então procuramos a data no que sobrou, e a apagamos também. Por fim,
 * a fração "nua" (sem palavra-chave, ex. só "2/3") é tentada como parcela
 * no texto já sem data. Isso resolve o caso comum (data "8/9" sem zero à
 * esquerda não vira "parcela 8 de 9" quando há um "parc" identificando a
 * fração real) mas tem um limite honesto: duas frações "nuas" sem nenhuma
 * palavra-chave, uma sendo a data e outra a parcela, são ambíguas de
 * verdade — a primeira encontrada no texto é lida como data. Isso não
 * costuma ocorrer na prática porque menções de parcela quase sempre vêm
 * acompanhadas de "parc"/"parcela"/"de", como nas amostras da Etapa 1.
 *
 * Regra de ouro herdada das etapas anteriores: o que não puder ser
 * determinado com segurança fica marcado como incerto, nunca adivinhado.
 */
import {
  classificarTipoSemantico,
  extrairFinalCartaoSeguro,
  extrairParcelaSegura,
  lerValorMonetario,
  normalizarCentavosPorTipo,
  type ConfiancaCampo,
  type LancamentoImportadoCompleto,
} from "./importacao-modelo";

const MESES_TXT: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Substitui um trecho por espaços do mesmo tamanho — preserva índices dos campos ainda não lidos. */
function apagarTrecho(texto: string, inicio: number, fim: number): string {
  return texto.slice(0, inicio) + " ".repeat(fim - inicio) + texto.slice(fim);
}

type Ocorrencia<T> = { valor: T; inicio: number; fim: number };

/**
 * Só as formas de parcela ANCORADAS por palavra-chave ("parc 2/3", "01 de
 * 03", "01D03") — nunca a fração nua "X/Y", que é ambígua com data. Mesmas
 * regras de `extrairParcelaSegura`, mas com posição, para poder apagar o
 * trecho do texto antes de procurar a data.
 */
function detectarParcelaAncorada(
  texto: string,
): Ocorrencia<{ atual: number; total: number }> | null {
  const padroes = [
    /\bparc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:de|d)\s*(\d{1,2})\b/i,
  ];
  for (const padrao of padroes) {
    const m = texto.match(padrao);
    if (!m || m.index == null) continue;
    const atual = Number(m[1]);
    const total = Number(m[2]);
    if (atual > 0 && total > 1 && atual <= total && total <= 99) {
      return { valor: { atual, total }, inicio: m.index, fim: m.index + m[0].length };
    }
  }
  return null;
}

/** Data numérica (dd/mm[/aaaa]) ou textual ("5 de agosto", "5 ago"). Nunca infere o ano de outra fonte além do texto/referência. */
function detectarData(texto: string, anoReferencia: number): Ocorrencia<string> | null {
  const numerica = texto.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numerica?.index != null) {
    const dia = Number(numerica[1]);
    const mes = Number(numerica[2]);
    let ano = numerica[3] ? Number(numerica[3]) : anoReferencia;
    if (ano < 100) ano += 2000;
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      return { valor: iso, inicio: numerica.index, fim: numerica.index + numerica[0].length };
    }
  }
  const textual = texto.match(/\b(\d{1,2})\s*(?:de\s*)?([A-Za-zÀ-ÿ]{3,9})\b/);
  if (textual?.index != null) {
    const mes = MESES_TXT[semAcento((textual[2] ?? "").toLowerCase())];
    const dia = Number(textual[1]);
    if (mes && dia >= 1 && dia <= 31) {
      const iso = `${anoReferencia}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      return { valor: iso, inicio: textual.index, fim: textual.index + textual[0].length };
    }
  }
  return null;
}

/**
 * Valor monetário com sinal antes ou depois. Exige símbolo de moeda,
 * vírgula decimal ou parênteses — um número inteiro "nu" nunca é lido como
 * valor aqui, porque também poderia ser parcela ou final de cartão; texto
 * livre sem nenhum desses sinais fica como valor ausente (incerto) em vez
 * de adivinhado.
 */
const RE_VALOR =
  /\(?\s*[+-]?\s*(?:R\$|US\$)\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*[+-]?\s*\)?|\(?\s*[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[+-]?\s*\)?/gi;

type ValorDetectado = Ocorrencia<ReturnType<typeof lerValorMonetario>> & { ambiguo: boolean };

function detectarValor(texto: string): ValorDetectado | null {
  const ocorrencias = [...texto.matchAll(RE_VALOR)].filter((m) => m[0].trim().length > 0);
  if (!ocorrencias.length) return null;
  const primeira = ocorrencias[0];
  if (!primeira || primeira.index == null) return null;
  const lido = lerValorMonetario(primeira[0]);
  if (!lido) return null;
  return {
    valor: lido,
    inicio: primeira.index,
    fim: primeira.index + primeira[0].length,
    ambiguo: ocorrencias.length > 1,
  };
}

export type LancamentoLivreResultado = {
  lancamento: LancamentoImportadoCompleto;
  /** Campos que não puderam ser determinados a partir do texto (nada foi inventado). */
  camposAusentes: Array<"data" | "valor" | "descricao">;
};

/** Interpreta um único lançamento a partir de uma linha de texto livre. */
export function interpretarLancamentoLivre(
  entrada: string,
  opts: { anoReferencia?: number; linha?: number } = {},
): LancamentoLivreResultado {
  const anoReferencia = opts.anoReferencia ?? new Date().getFullYear();
  const original = entrada.trim();

  // 1) Parcela ancorada por palavra-chave primeiro — nunca ambígua com data.
  const parcelaAncorada = detectarParcelaAncorada(original);
  const semParcelaAncorada = parcelaAncorada
    ? apagarTrecho(original, parcelaAncorada.inicio, parcelaAncorada.fim)
    : original;

  // 2) Data no texto já sem a parcela ancorada — evita ler "2/3" como "02/03".
  const dataOcorrencia = detectarData(semParcelaAncorada, anoReferencia);
  const semData = dataOcorrencia
    ? apagarTrecho(semParcelaAncorada, dataOcorrencia.inicio, dataOcorrencia.fim)
    : semParcelaAncorada;

  const valorOcorrencia = detectarValor(semData);
  const semDataValor = valorOcorrencia
    ? apagarTrecho(semData, valorOcorrencia.inicio, valorOcorrencia.fim)
    : semData;

  // 3) Só agora, com data e valor já retirados, tenta a fração "nua" (sem
  // palavra-chave) como parcela — nesse ponto já não há data para confundir.
  const parcela = parcelaAncorada?.valor ?? extrairParcelaSegura(semDataValor);
  const cartaoFinal = extrairFinalCartaoSeguro(semDataValor);

  const descricao = semDataValor.replace(/[,;]/g, " ").replace(/\s+/g, " ").trim();

  const tipo = classificarTipoSemantico(descricao || original, null);

  const confiancaData: ConfiancaCampo = dataOcorrencia ? "alta" : "baixa";
  const confiancaValor: ConfiancaCampo = !valorOcorrencia
    ? "baixa"
    : valorOcorrencia.ambiguo
      ? "baixa"
      : "alta";
  const confiancaDescricao: ConfiancaCampo = descricao ? "media" : "baixa";

  const camposAusentes: LancamentoLivreResultado["camposAusentes"] = [];
  if (!dataOcorrencia) camposAusentes.push("data");
  if (!valorOcorrencia) camposAusentes.push("valor");
  if (!descricao) camposAusentes.push("descricao");

  const valorAbsoluto = valorOcorrencia?.valor?.centavosAbsolutos ?? null;

  const lancamento: LancamentoImportadoCompleto = {
    id: crypto.randomUUID(),
    dataCompra: dataOcorrencia?.valor ?? null,
    descricaoOriginal: original,
    descricaoNormalizada: descricao || original,
    tipo,
    valorBruto: valorOcorrencia
      ? original.slice(valorOcorrencia.inicio, valorOcorrencia.fim).trim()
      : "",
    valorNormalizadoCentavos:
      valorAbsoluto != null ? normalizarCentavosPorTipo(valorAbsoluto, tipo) : null,
    moeda: valorOcorrencia?.valor?.moeda === "USD" ? "USD" : "BRL",
    sinalOriginal: valorOcorrencia?.valor?.sinalOriginal ?? "positivo",
    parcelaAtual: parcela?.atual ?? null,
    parcelaTotal: parcela?.total ?? null,
    cartaoFinal: cartaoFinal,
    titular: null,
    evidencia: { pagina: null, trecho: original, secao: null },
    confianca: {
      data: confiancaData,
      descricao: confiancaDescricao,
      valor: confiancaValor,
      tipo: descricao || original ? "media" : "baixa",
      parcela: parcela ? "alta" : "alta", // ausência de parcela é uma leitura confiante (compra à vista)
      cartao: cartaoFinal ? "alta" : "alta", // idem — ausência de cartão não é incerteza, é informação não presente
    },
    exigeRevisao: !dataOcorrencia || !valorOcorrencia || valorOcorrencia.ambiguo || !descricao,
  };

  return { lancamento, camposAusentes };
}

/** Interpreta um bloco colado, um lançamento por linha (linhas vazias são ignoradas). */
export function interpretarBlocoLivre(
  bloco: string,
  opts: { anoReferencia?: number } = {},
): LancamentoLivreResultado[] {
  return bloco
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha, indice) => interpretarLancamentoLivre(linha, { ...opts, linha: indice }));
}
