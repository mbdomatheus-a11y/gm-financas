/**
 * Exportação simples para Excel (.xlsx) e texto (.txt), sem dependências novas.
 * O .xlsx é montado à mão (ZIP sem compressão + XML mínimo), o suficiente para
 * abrir no Excel, LibreOffice e Google Planilhas.
 */

type Celula = string | number | null | undefined;

const encoder = new TextEncoder();

function tabelaCrc(): Uint32Array {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABELA = tabelaCrc();

function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = CRC_TABELA[(c ^ dados[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function escaparXml(valor: string): string {
  return valor
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letraColuna(indice: number): string {
  let n = indice;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function montarPlanilhaXml(cabecalho: string[], linhas: Celula[][]): string {
  const todas: Celula[][] = [cabecalho, ...linhas];
  const corpo = todas
    .map((linha, r) => {
      const celulas = linha
        .map((v, c) => {
          const ref = `${letraColuna(c)}${r + 1}`;
          if (v === null || v === undefined || v === "") return "";
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${celulas}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${corpo}</sheetData></worksheet>`;
}

type ArquivoZip = { nome: string; dados: Uint8Array };

function montarZip(arquivos: ArquivoZip[]): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;
  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const arq of arquivos) {
    const nome = encoder.encode(arq.nome);
    const crc = crc32(arq.dados);
    const tam = arq.dados.length;
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(tam), ...u32(tam), ...u16(nome.length), ...u16(0),
    ]);
    partes.push(local, nome, arq.dados);
    const entrada = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(tam), ...u32(tam), ...u16(nome.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(deslocamento),
    ]);
    central.push(entrada, nome);
    deslocamento += local.length + nome.length + tam;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length),
    ...u32(tamCentral), ...u32(deslocamento), ...u16(0),
  ]);
  const todas = [...partes, ...central, fim];
  const saida = new Uint8Array(todas.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of todas) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

export function gerarXlsx(cabecalho: string[], linhas: Celula[][], nomeAba = "Dados"): Uint8Array {
  const aba = escaparXml(nomeAba.slice(0, 31) || "Dados");
  const arquivos: ArquivoZip[] = [
    {
      nome: "[Content_Types].xml",
      dados: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
      ),
    },
    {
      nome: "_rels/.rels",
      dados: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      nome: "xl/workbook.xml",
      dados: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${aba}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      dados: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      ),
    },
    { nome: "xl/worksheets/sheet1.xml", dados: encoder.encode(montarPlanilhaXml(cabecalho, linhas)) },
  ];
  return montarZip(arquivos);
}

function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baixarXlsx(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]) {
  const dados = gerarXlsx(cabecalho, linhas);
  baixarBlob(
    new Blob([dados as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    nomeArquivo.endsWith(".xlsx") ? nomeArquivo : `${nomeArquivo}.xlsx`,
  );
}

/** TXT separado por TAB (abre no Excel também), com cabeçalho na primeira linha. */
export function baixarTxt(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]) {
  const limpar = (v: Celula) => String(v ?? "").replace(/[\t\r\n]+/g, " ");
  const texto = [cabecalho, ...linhas].map((l) => l.map(limpar).join("\t")).join("\r\n");
  baixarBlob(
    new Blob(["﻿" + texto], { type: "text/plain;charset=utf-8" }),
    nomeArquivo.endsWith(".txt") ? nomeArquivo : `${nomeArquivo}.txt`,
  );
}
