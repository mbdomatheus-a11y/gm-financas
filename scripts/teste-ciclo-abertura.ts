/**
 * Teste do ciclo ao abrir (13/11/2026). Rodar: npx tsx scripts/teste-ciclo-abertura.ts
 * Virada 15 do grupo: hoje 13/11/2026 = ciclo 16/out a 15/nov, "Ciclo de novembro"; hoje 16/11/2026 = 16/nov a 15/dez.
 * Mesmo teste no app (controlall/scripts/teste-ciclo-abertura.ts).
 */
import { competenciaDoDia, definirViradaDoGrupo } from "../src/lib/format";
import { janelasDoCiclo, mesDoCicloEm } from "../src/lib/numeros-ciclo";
import { nomeDoCiclo, rotuloDoCiclo } from "../src/lib/rotulo-ciclo";

let falhas = 0;
function igual(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}: ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

definirViradaDoGrupo(15);
const casos: [string, Date, string, string, string][] = [
  ["13/11", new Date(2026, 10, 13, 10), "2026-10", "16/out a 15/nov", "Ciclo de novembro"],
  ["15/11 (dia D)", new Date(2026, 10, 15, 10), "2026-10", "16/out a 15/nov", "Ciclo de novembro"],
  ["16/11", new Date(2026, 10, 16, 10), "2026-11", "16/nov a 15/dez", "Ciclo de dezembro"],
];
for (const [nome, hoje, chave, periodo, rotulo] of casos) {
  const mes = mesDoCicloEm(hoje, 15);
  igual(`${nome} chave`, mes, chave);
  igual(`${nome} competenciaDoDia`, competenciaDoDia(hoje), chave);
  igual(`${nome} período`, janelasDoCiclo(mes, 15).rotulo, periodo);
  igual(`${nome} nome`, nomeDoCiclo(mes, undefined, hoje), rotulo);
  igual(`${nome} rótulo`, rotuloDoCiclo(mes, undefined, hoje), `${rotulo} · ${periodo}`);
}
// Setas: anterior e próximo andam de ciclo em ciclo.
igual("anterior", rotuloDoCiclo("2026-09", 15, new Date(2026, 10, 13)), "Ciclo de outubro · 16/set a 15/out");
igual("próximo do ano seguinte", rotuloDoCiclo("2026-12", 15, new Date(2026, 10, 13)), "Ciclo de janeiro de 2027 · 16/dez a 15/jan");

if (falhas) {
  console.log(`${falhas} falha(s)`);
  process.exit(1);
}
console.log("Tudo certo");
