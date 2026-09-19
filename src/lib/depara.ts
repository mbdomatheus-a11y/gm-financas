/** Leitura de planilhas (XLSX/CSV) com o "de-para" de descrição → categoria. */
import { readSheet } from "read-excel-file/browser";

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
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
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
  if (file.size > 5 * 1024 * 1024) throw new Error("A planilha deve ter no máximo 5 MB.");
  const nome = file.name.toLowerCase();
  let matriz: unknown[][];
  if (nome.endsWith(".xlsx")) {
    matriz = await readSheet(file);
  } else if (nome.endsWith(".csv")) {
    matriz = lerCsv(await file.text());
  } else {
    throw new Error(
      "Use um arquivo .xlsx ou .csv. Para .xls, exporte como .xlsx antes de importar.",
    );
  }
  if (matriz.length > 10001) throw new Error("A planilha pode ter no máximo 10 mil linhas.");
  const colunas = (matriz[0] ?? []).map((valor) => String(valor ?? "").trim());
  const cDesc = achar(colunas, COL_DESCRICAO) ?? colunas[0];
  const cCat = achar(colunas, COL_CATEGORIA) ?? colunas[1];
  const cSub = achar(colunas, COL_SUB);
  if (!cDesc || !cCat) return [];
  const descIdx = colunas.indexOf(cDesc);
  const catIdx = colunas.indexOf(cCat);
  const subIdx = cSub ? colunas.indexOf(cSub) : -1;

  const vistos = new Set<string>();
  const out: LinhaDePara[] = [];
  for (const linha of matriz.slice(1)) {
    const descricao = String(linha[descIdx] ?? "").trim();
    const categoria = String(linha[catIdx] ?? "").trim();
    if (!descricao || !categoria) continue;
    const chave = chaveEstabelecimento(descricao);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    const sub = subIdx >= 0 ? String(linha[subIdx] ?? "").trim() : "";
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

function lerCsv(conteudo: string): string[][] {
  const primeiraLinha = conteudo.split(/\r?\n/, 1)[0] ?? "";
  const separador =
    (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const char = conteudo[i];
    if (char === '"') {
      if (entreAspas && conteudo[i + 1] === '"') {
        campo += '"';
        i++;
      } else entreAspas = !entreAspas;
    } else if (char === separador && !entreAspas) {
      linha.push(campo);
      campo = "";
    } else if ((char === "\n" || char === "\r") && !entreAspas) {
      if (char === "\r" && conteudo[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((valor) => valor.trim())) linhas.push(linha);
      linha = [];
    } else {
      campo += char;
    }
  }
  linha.push(campo);
  if (linha.some((valor) => valor.trim())) linhas.push(linha);
  if (linhas[0]?.[0]) linhas[0][0] = linhas[0][0].replace(/^\uFEFF/, "");
  return linhas;
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
