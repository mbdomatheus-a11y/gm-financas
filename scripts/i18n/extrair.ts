/**
 * Lista todos os textos de interface (mesma regra do build) e confere se o código
 * transformado continua válido. Uso: npx tsx scripts/i18n/extrair.ts
 * Gera src/lib/i18n/dicionarios/_fonte-pt.json (chaves em português, em ordem).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { encontrarTextos, transformarCodigo } from "./transform.ts";

const raiz = process.cwd();
const arquivos: string[] = [];
(function andar(d: string) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) {
      if (!/node_modules|integrations/.test(p)) andar(p);
    } else if (n.endsWith(".tsx") && !/\.test\.|routeTree\.gen/.test(n)) arquivos.push(p);
  }
})(path.join(raiz, "src"));

const chaves = new Set<string>();
let trocas = 0;
const erros: string[] = [];
for (const arq of arquivos) {
  const codigo = fs.readFileSync(arq, "utf8");
  for (const e of encontrarTextos(codigo, arq)) chaves.add(e.chave);
  const r = transformarCodigo(codigo, arq);
  if (!r) continue;
  trocas += r.total;
  const saida = ts.transpileModule(r.codigo, {
    fileName: arq,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const diag = (saida.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diag.length) erros.push(`${path.relative(raiz, arq)}: ${ts.flattenDiagnosticMessageText(diag[0]!.messageText, " ")}`);
}
const lista = [...chaves].sort((a, b) => a.localeCompare(b, "pt-BR"));
fs.writeFileSync(path.join(raiz, "src/lib/i18n/dicionarios/_fonte-pt.json"), JSON.stringify(lista, null, 1) + "\n");
console.log(`arquivos ${arquivos.length} | trocas ${trocas} | textos únicos ${lista.length} | caracteres ${lista.join("").length}`);
// Cobertura dos dicionários: texto novo sem tradução aparece em português até ser traduzido.
for (const idioma of ["en", "es", "hi", "fr", "de", "it", "zh", "ar"]) {
  const arq = path.join(raiz, `src/lib/i18n/dicionarios/${idioma}.json`);
  const dic = fs.existsSync(arq) ? (JSON.parse(fs.readFileSync(arq, "utf8")) as Record<string, string>) : {};
  const faltam = lista.filter((k) => !dic[k]);
  console.log(`${idioma}: ${lista.length - faltam.length}/${lista.length} traduzidos${faltam.length ? ` | faltam ${faltam.length} (ex.: ${JSON.stringify(faltam[0])})` : ""}`);
}
if (erros.length) {
  console.log("ERROS DE SINTAXE APÓS TRANSFORMAR:");
  for (const e of erros) console.log(" -", e);
  process.exitCode = 1;
}
