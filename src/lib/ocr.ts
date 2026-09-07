import { corrigirTexto, detectarBanco, extrairFinais, normalizarDescricao, type LancamentoExtraido } from "@/lib/faturas";

/**
 * OCR client-side com tesseract.js (WASM). Zero custo de IA.
 * Carrega os dados de idioma por do CDN; funciona no navegador.
 */

/** Amplia e aumenta o contraste da imagem antes do OCR (prints de celular são pequenos). */
async function prepararImagem(file: File): Promise<string | File> {
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(4, Math.max(1, 1800 / bitmap.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    // Escala de cinza + binarização suave: ajuda muito em prints de tema escuro.
    let soma = 0;
    const cinza = new Uint8ClampedArray(d.length / 4);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const g = (d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114) | 0;
      cinza[j] = g;
      soma += g;
    }
    const media = soma / cinza.length;
    const escuro = media < 128; // print com fundo escuro → inverte
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      let g = cinza[j]!;
      if (escuro) g = 255 - g;
      // aumenta contraste em torno de 50%
      g = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128));
      d[i] = d[i + 1] = d[i + 2] = g;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return file;
  }
}

export async function ocrImagem(file: File): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const entrada = await prepararImagem(file);
  const { data } = await Tesseract.recognize(entrada as string, "por", {
    logger: () => {},
  });
  return data.text ?? "";
}

const RE_VALOR_FIM =
  /(-?\s*(?:R\$|RS|US\$)?\s*-?\d{1,3}(?:[.\s]\d{3})*[,.]\d{2}\s*-?)\s*$/i;
const RE_SO_VALOR = /^(-?\s*(?:R\$|RS|US\$)?\s*-?\d{1,3}(?:[.\s]\d{3})*[,.]\d{2}\s*-?)$/i;
const RE_DATA_INICIO =
  /^(\d{1,2}\s*[/.\-]\s*\d{1,2}(?:\s*[/.\-]\s*\d{2,4})?|\d{1,2}\s+de\s+[a-zç]{3,}|\d{1,2}\s+[a-zç]{3}\.?|\d{4}|\d{8})(?=\s|$)/i;
const RE_PARCELA = /(\d{1,2})\s*(?:\/|de|x)\s*(\d{1,2})/i;
const RE_RUIDO =
  /^(total|saldo|limite|fatura|vencimento|melhor dia|dispon|pagamento (recebido|efetuado)|pagto|extrato|lançamentos|lancamentos|movimenta|entradas|saídas|saidas|resumo|conta|agência|agencia)/i;

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/** Aceita 1.234,56 e também 1234.56 (o OCR costuma trocar vírgula por ponto). */
function valorOcr(raw: string): number {
  const limpo = raw.replace(/\s/g, "").replace(/R\$|RS|US\$/gi, "");
  const negativo = /^-/.test(limpo) || /-$/.test(limpo);
  const nums = limpo.replace(/-/g, "");
  let normal: string;
  if (/,\d{2}$/.test(nums)) normal = nums.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{2}$/.test(nums)) {
    const partes = nums.split(".");
    const dec = partes.pop()!;
    normal = `${partes.join("")}.${dec}`;
  } else normal = nums.replace(/[.,]/g, "");
  const n = Number(normal);
  if (!Number.isFinite(n)) return 0;
  return negativo ? -n : n;
}

function dataOcr(raw: string, anoBase: number): string | null {
  const txt = raw.replace(/\s+/g, " ").trim();
  const sep = txt.match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{2,4}))?$/);
  if (sep) {
    const d = Number(sep[1]);
    const m = Number(sep[2]);
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    const y = sep[3] ? (sep[3].length === 2 ? 2000 + Number(sep[3]) : Number(sep[3])) : anoBase;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const texto = txt.match(/^(\d{1,2})\s+(?:de\s+)?([a-zç]{3})/i);
  if (texto) {
    const m = MESES[texto[2]!.toLowerCase()];
    const d = Number(texto[1]);
    if (m && d >= 1 && d <= 31)
      return `${anoBase}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // OCR perdeu as barras: "1208" = 12/08, "12082026" = 12/08/2026
  const cru = txt.match(/^(\d{2})(\d{2})(\d{4})?$/);
  if (cru) {
    const d = Number(cru[1]);
    const m = Number(cru[2]);
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    return `${cru[3] ? Number(cru[3]) : anoBase}-${cru[2]}-${cru[1]}`;
  }
  return null;
}

function limparDescricao(raw: string): string {
  return corrigirTexto(raw)
    .replace(/^[\s\-—–·•|:]+/, "")
    .replace(/[\s\-—–·•|:]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const RE_SUBTITULO = /^(cart[aã]o\s|cartao\s|conta\s|pix\b|d[eé]bito\b|cr[eé]dito\b)/i;
const RE_PARCELA_LINHA = /parcela\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i;
const RE_LIXO_FIM = /[\s>»›?)\]|~^"'`.,;:*·•\-–—]+$/;

/** Remove ícones/setas que o OCR captura no fim da linha ("R$ 7,99 >"). */
function limparFim(linha: string): string {
  return linha.replace(RE_LIXO_FIM, "");
}

function contarValores(linha: string): number {
  return (linha.match(/(?:R\$|RS|US\$)\s*-?\d/gi) ?? []).length;
}

/**
 * Parser tolerante para texto de OCR de apps de banco/fatura:
 * data como cabeçalho de grupo, descrição quebrada em várias linhas,
 * valor na mesma linha ou na seguinte e "Parcela 1 de 4" em linha própria.
 */
export function lancamentosDeTextoOcr(texto: string, anoBase = new Date().getFullYear()) {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/[|]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: LancamentoExtraido[] = [];
  let seq = 0;
  let dataContexto = "";
  let pendente: string[] = [];
  const hoje = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const empurrar = (descBruta: string, bruto: string, moedaLinha: string, estimado: boolean) => {
    const descricao = limparDescricao(descBruta);
    if (descricao.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 3) return;
    const valor = valorOcr(bruto);
    if (!valor) return;
    const parc = descricao.match(RE_PARCELA);
    const numero = parc ? Number(parc[1]) : 1;
    const total = parc ? Number(parc[2]) : 1;
    out.push({
      id: `o${seq++}`,
      data_compra: dataContexto,
      descricao,
      descricao_normalizada: normalizarDescricao(descricao),
      valor: Math.abs(valor),
      moeda: /US\$|USD/i.test(moedaLinha) ? "USD" : "BRL",
      direcao: valor < 0 ? "credito" : "debito",
      parcela_numero: numero > 0 && numero <= total ? numero : 1,
      parcela_total: total >= 1 && total <= 99 ? total : 1,
      cartao_final: null,
      responsavel: null,
      categoria: "outros",
      confianca_data: dataContexto ? "media" : "baixa",
      valor_estimado: estimado,
      incluir: true,
    });
  };

  for (let i = 0; i < linhas.length; i++) {
    const original = linhas[i]!;
    const linha = limparFim(original);
    if (!linha) continue;

    // Faixa de meses/resumo no topo do print (vários valores na mesma linha).
    if (contarValores(linha) > 1) {
      pendente = [];
      continue;
    }

    // "Parcela 1 de 4" costuma vir depois do lançamento.
    const mParc = linha.match(RE_PARCELA_LINHA);
    if (mParc && !RE_VALOR_FIM.test(linha)) {
      const ult = out[out.length - 1];
      if (ult) {
        const n = Number(mParc[1]);
        const t = Number(mParc[2]);
        if (t >= 1 && t <= 99 && n >= 1 && n <= t) {
          ult.parcela_numero = n;
          ult.parcela_total = t;
        }
      }
      continue;
    }

    if (/^hoje\b/i.test(linha)) {
      dataContexto = iso(hoje);
      pendente = [];
      continue;
    }
    if (/^ontem\b/i.test(linha)) {
      dataContexto = iso(new Date(hoje.getTime() - 86400000));
      pendente = [];
      continue;
    }

    const soData = linha.match(RE_DATA_INICIO);
    if (soData && soData[0].trim().length === linha.length) {
      const d = dataOcr(linha, anoBase);
      if (d) {
        dataContexto = d;
        pendente = [];
        continue;
      }
    }

    let mValor = linha.match(RE_VALOR_FIM);
    let alvo = linha;
    if (!mValor) {
      const prox = linhas[i + 1] ? limparFim(linhas[i + 1]!) : "";
      if (prox && RE_SO_VALOR.test(prox)) {
        alvo = `${linha} ${prox}`;
        mValor = alvo.match(RE_VALOR_FIM);
        i++;
      }
    }

    if (!mValor) {
      if (RE_RUIDO.test(linha) || RE_SUBTITULO.test(linha)) continue;
      pendente.push(linha);
      if (pendente.length > 3) pendente.shift();
      continue;
    }

    const bruto = mValor[1]!;
    let resto = alvo.slice(0, alvo.length - mValor[0].length).trim();

    // Linha do tipo "Cartão físico R$ 28,05": o texto é subtítulo, a descrição está pendente.
    if (RE_SUBTITULO.test(resto) || RE_RUIDO.test(resto)) resto = "";

    let data = dataContexto;
    const mData = resto.match(RE_DATA_INICIO);
    if (mData) {
      const d = dataOcr(mData[1]!, anoBase);
      if (d) {
        data = d;
        resto = resto.slice(mData[0].length).trim();
      }
    }
    const anterior = dataContexto;
    dataContexto = data;
    empurrar([...pendente, resto].filter(Boolean).join(" "), bruto, alvo, false);
    dataContexto = anterior || data;
    pendente = [];
  }

  return out;
}


/** Extrai lançamentos do texto OCR aplicando o parser tolerante de prints. */
export function lancamentosDeOcr(texto: string): {
  lancamentos: LancamentoExtraido[];
  banco: ReturnType<typeof detectarBanco>;
  finais: string[];
} {
  const banco = detectarBanco(texto, "");
  const finais = extrairFinais(texto);
  const lancamentos = lancamentosDeTextoOcr(texto);
  return { lancamentos, banco, finais };
}

/** Reaproveita o hasher de texto (sem arquivo) para a prévia de prints. */
export async function hashTexto(texto: string): Promise<string> {
  const buf = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
