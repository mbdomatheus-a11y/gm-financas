// Rodar: npx tsx scripts/teste-simulador.ts
import { simularRendimento, taxaMensalPoupanca } from "../src/lib/simulador-rendimento";

const s = simularRendimento(4000, 14.9, 15, 0);
const ok = (c: boolean, m: string) => { if (!c) { console.error("FALHOU: " + m); process.exit(1); } };
for (const m of [12, 24, 36] as const) {
  const [p, a, b, c] = s.linhas.map((l) => l.prazos[m].final);
  ok(p < a && a < b && b < c, `ordem poupança < 100% < 110% < 120% em ${m} meses (${p} ${a} ${b} ${c})`);
  ok(s.melhor[m] === "cdi120", "melhor é 120% do CDI");
}
// Poupança: 0,5% ao mês, isenta de IR
ok(Math.abs(s.linhas[0].prazos[12].final - 4000 * Math.pow(1.005, 12)) < 0.01, "poupança 12 meses = 0,5% a.m.");
// IR: 12 meses 17,5% sobre o ganho bruto
const bruto = 4000 * (Math.pow(1 + 14.9 / 100, 1) - 1);
ok(Math.abs(s.linhas[1].prazos[12].ganho - bruto * 0.825) < 0.02, "IR 17,5% em 12 meses");
const bruto24 = 4000 * (Math.pow(1.149, 2) - 1);
ok(Math.abs(s.linhas[1].prazos[24].ganho - bruto24 * 0.85) < 0.02, "IR 15% em 24 meses");
// Selic baixa: 70% da Selic
ok(Math.abs(taxaMensalPoupanca(8, 0) - (Math.pow(1.056, 1 / 12) - 1)) < 1e-9, "70% da Selic quando Selic <= 8,5");
// TR soma
ok(taxaMensalPoupanca(15, 0.1) > taxaMensalPoupanca(15, 0), "TR soma na poupança");
console.log("ok", s.linhas.map((l) => `${l.rotulo}: ${l.prazos[12].final} / ${l.prazos[24].final} / ${l.prazos[36].final}`).join(" | "));
