/** Leitura de planilhas (XLSX/CSV) com o "de-para" de descrição → categoria. */
import * as XLSX from "xlsx";

import { chaveEstabelecimento, normalizarEstabelecimento } from "@/lib/categorizacao";

export type LinhaDePara = {
  descricao: string;
  estabelecimento_normalizado: string;
  categoria: string;
  subcategoria: string | null;
  prioridade: number;
};

const COL_DESCRICAO = ["descricao", "descrição", "estabelecimento", "texto", "item", "nome", "de"];
const COL_CATEGORIA = ["categoria", "para", "classificacao", "classificação"];
const COL_SUB = ["subcategoria", "sub", "detalhe"];

function achar(colunas: string[], alvos: string[]): string | null {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  for (const alvo of alvos) {
    const encontrada = colunas.find((c) => norm(c) === norm(alvo));
    if (encontrada) return encontrada;
  }
  for (const alvo of alvos) {
    const encontrada = colunas.find((c) => norm(c).includes(norm(alvo)));
    if (encontrada) return encontrada;
  }
  return null;
}

/** Lê o arquivo enviado e devolve as linhas válidas do de-para. */
export async function lerPlanilhaDePara(file: File): Promise<LinhaDePara[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const nomePlanilha = wb.SheetNames[0];
  if (!nomePlanilha) return [];
  const sheet = wb.Sheets[nomePlanilha];
  if (!sheet) return [];
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!linhas.length) return [];

  const colunas = Object.keys(linhas[0] ?? {});
  const cDesc = achar(colunas, COL_DESCRICAO) ?? colunas[0];
  const cCat = achar(colunas, COL_CATEGORIA) ?? colunas[1];
  const cSub = achar(colunas, COL_SUB);
  if (!cDesc || !cCat) return [];

  const vistos = new Set<string>();
  const out: LinhaDePara[] = [];
  for (const l of linhas) {
    const descricao = String(l[cDesc] ?? "").trim();
    const categoria = String(l[cCat] ?? "").trim();
    if (!descricao || !categoria) continue;
    const chave = chaveEstabelecimento(descricao);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    const sub = cSub ? String(l[cSub] ?? "").trim() : "";
    out.push({
      descricao: normalizarEstabelecimento(descricao),
      estabelecimento_normalizado: chave,
      categoria,
      subcategoria: sub || null,
      prioridade: 200,
    });
  }
  return out;
}

/** Modelo em CSV para o usuário preencher. */
export function modeloCsv(): string {
  return [
    "descricao,categoria,subcategoria",
    "Netflix,Assinaturas / Serviços Digitais,Streaming",
    "ChatGPT,Assinaturas / Serviços Digitais / IA,IA",
    "Uber,Transporte,Aplicativos",
  ].join("\n");
}
