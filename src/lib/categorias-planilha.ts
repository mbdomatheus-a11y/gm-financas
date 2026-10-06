import { readSheet } from "read-excel-file/browser";
import { CATEGORIAS_PADRAO } from "@/lib/categorizacao";
import { lerCsv } from "@/lib/depara";

/** Itens 3 e 4 (2026-10-05): modelo/lista sugerida de categorias e leitura do arquivo editado. */
export const CABECALHO_CATEGORIAS = ["tipo", "categoria", "subcategoria", "cor"];

export type LinhaCategoria = { tipo: "despesa" | "receita"; nome: string; cor: string | null };

/** Lista sugerida completa do site (uma linha por subcategoria). */
export function linhasListaSugerida(): string[][] {
  const out: string[][] = [];
  for (const [cat, subs] of Object.entries(CATEGORIAS_PADRAO)) {
    if (subs.length === 0) out.push(["despesa", cat, "", ""]);
    for (const sub of subs) out.push(["despesa", cat, sub, ""]);
  }
  return out;
}

export function linhasMinhasCategorias(
  cats: { nome: string; cor?: string | null }[],
  tipo: "despesa" | "receita",
): string[][] {
  return cats.map((c) => [tipo, c.nome, "", c.cor ?? ""]);
}

export async function lerPlanilhaCategorias(
  file: File,
  tipoPadrao: "despesa" | "receita",
): Promise<LinhaCategoria[]> {
  if (file.size > 2 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 2 MB.");
  const nome = file.name.toLowerCase();
  let matriz: unknown[][];
  if (nome.endsWith(".xlsx")) matriz = await readSheet(file);
  else if (nome.endsWith(".csv") || nome.endsWith(".txt")) matriz = lerCsv(await file.text());
  else throw new Error("Use um arquivo .xlsx, .csv ou .txt.");
  if (matriz.length > 5001) throw new Error("O arquivo pode ter no máximo 5 mil linhas.");
  const cab = (matriz[0] ?? []).map((v) =>
    String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
  );
  const iCat = cab.indexOf("categoria") >= 0 ? cab.indexOf("categoria") : 0;
  const iTipo = cab.indexOf("tipo");
  const iCor = cab.indexOf("cor");
  const vistos = new Set<string>();
  const out: LinhaCategoria[] = [];
  for (const linha of matriz.slice(1)) {
    const nomeCat = String(linha[iCat] ?? "").trim().slice(0, 40);
    if (nomeCat.length < 2) continue;
    const t = iTipo >= 0 ? String(linha[iTipo] ?? "").trim().toLowerCase() : "";
    const tipo: "despesa" | "receita" = t === "receita" ? "receita" : t === "despesa" ? "despesa" : tipoPadrao;
    const chave = `${tipo}:${nomeCat.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const cor = iCor >= 0 ? String(linha[iCor] ?? "").trim() : "";
    out.push({ tipo, nome: nomeCat, cor: /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : null });
  }
  return out;
}
