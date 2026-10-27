import fs from "node:fs"; import path from "node:path";
import { arquivoTraduzivel, encontrarTextos } from "./scripts/i18n/transform.ts";
const out: string[] = [];
(function andar(d: string) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n);
  if (fs.statSync(p).isDirectory()) andar(p); else if (p.endsWith(".ts") && arquivoTraduzivel(p)) {
    const e = encontrarTextos(fs.readFileSync(p, "utf8"), p).filter((x) => x.chave);
    if (e.length) out.push(`${p} ${e.length}: ${e.slice(0, 3).map((x) => x.chave.slice(0, 40)).join(" | ")}`); } } })("src");
console.log(out.join("\n"));
