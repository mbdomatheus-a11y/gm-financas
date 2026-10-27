import fs from "node:fs";
import { transformarCodigo } from "./scripts/i18n/transform.ts";
for (const [f, pat] of [["src/routes/_authenticated/dashboard.tsx", /__tj\("\{0\} parcela|\/mês|__locale/], ["src/lib/format.ts", /__locale|__t\(/], ["src/lib/areas.ts", /__t\(/]] as const) {
  const r = transformarCodigo(fs.readFileSync(f, "utf8"), f)!;
  console.log("==", f, r.total);
  console.log(r.codigo.split("\n").filter((l) => pat.test(l)).slice(0, 6).join("\n"));
}
