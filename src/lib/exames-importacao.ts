import { ocrImagem } from "@/lib/ocr";

export type MedicaoRascunho = { indicador: string; valorTexto: string; valor: number | null; unidade: string; referencia: string; incluir: boolean };

export async function textoDeExame(arquivo: File): Promise<string> {
  if (arquivo.type.startsWith("image/")) return ocrImagem(arquivo);
  if (arquivo.type !== "application/pdf") throw new Error("Envie PDF, JPG, PNG ou WEBP.");
  const pdfjs = await import("pdfjs-dist");
  const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const paginas: string[] = [];
  for (let pagina = 1; pagina <= Math.min(pdf.numPages, 30); pagina++) {
    const conteudo = await (await pdf.getPage(pagina)).getTextContent();
    paginas.push(conteudo.items.map((item: any) => item.str ?? "").join(" "));
  }
  return paginas.join("\n");
}

/** Extrator propositalmente conservador: produz rascunhos para aprovação, não diagnóstico. */
export function medicoesDoTexto(texto: string): MedicaoRascunho[] {
  const linhas = texto.split(/\r?\n/).flatMap((x) => x.split(/ {2,}/)).map((x) => x.trim()).filter(Boolean);
  const vistos = new Set<string>(); const resultado: MedicaoRascunho[] = [];
  for (const linha of linhas) {
    const match = linha.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .()/%+-]{2,70}?)\s+(-?\d+(?:[.,]\d+)?)\s*([A-Za-zµ%/³0-9.-]{0,16})(?:\s+(?:ref(?:er[êe]ncia)?[:.]?\s*)?(.{2,100}))?$/i);
    if (!match) continue;
    const indicador = (match[1] ?? "").replace(/\s+/g, " ").trim(); const valorTexto = match[2] ?? ""; const unidade = match[3] || ""; const referencia = match[4]?.trim() || "";
    if (/^(resultado|m[ée]todo|material|data|idade|p[áa]gina|cliente|paciente|unidade)$/i.test(indicador)) continue;
    const chave = `${indicador}|${valorTexto}|${unidade}`.toLowerCase(); if (vistos.has(chave)) continue; vistos.add(chave);
    resultado.push({ indicador, valorTexto, valor: Number(valorTexto.replace(",", ".")), unidade, referencia, incluir: true });
  }
  return resultado.slice(0, 120);
}
