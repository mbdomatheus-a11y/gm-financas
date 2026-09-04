import { extrairLancamentos, extrairFinais, detectarBanco, type LancamentoExtraido } from "@/lib/faturas";

/**
 * OCR client-side com tesseract.js (WASM). Zero custo de IA.
 * Carrega os dados de idioma por do CDN; funciona no navegador.
 */
export async function ocrImagem(file: File): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const url = URL.createObjectURL(file);
  try {
    const { data } = await Tesseract.recognize(url, "por", {
      logger: () => {},
    });
    return data.text ?? "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Extrai lançamentos do texto OCR aplicando o mesmo parser determinístico do PDF. */
export function lancamentosDeOcr(texto: string): {
  lancamentos: LancamentoExtraido[];
  banco: ReturnType<typeof detectarBanco>;
  finais: string[];
} {
  const banco = detectarBanco(texto, "");
  const finais = extrairFinais(texto);
  const lancamentos = extrairLancamentos(texto, null);
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
