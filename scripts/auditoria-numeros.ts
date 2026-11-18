// Auditoria das caixas de soma do ciclo (somente leitura). Uso: npx tsx scripts/auditoria-numeros.ts 2026-11
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { calcularNumerosCiclo, lancamentosDoCiclo, receitasDoCiclo, janelasDoCiclo, previsaoPeloRitmo } from "../src/lib/numeros-ciclo";
import { receitasPorCompetencias } from "../src/lib/recorrencia";
import { contaComoDespesa } from "../src/lib/regras-saldo";

const env: Record<string, string> = {};
for (const f of [".env", ".env.local"]) {
  try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l); if (m) env[m[1]!] = m[2]!.replace(/^"|"$/g, ""); } } catch {}
}
const db = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const GRUPO = process.argv[3] ?? "00000000-0000-0000-0000-000000000001";
const mes = process.argv[2] ?? "2026-11";
const r2 = (v: number) => Math.round(v * 100) / 100;

async function todos(tabela: string, sel: string) {
  const out: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await db.from(tabela).select(sel).eq("grupo_id", GRUPO).range(i, i + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
const despesas = await todos("despesas", "*, parcelas(*), cartoes(apelido, titular, final, cor), bancos(nome)");
const receitas = await todos("receitas", "*");
const faturas = await todos("fatura_mes", "*");
const cartoes = await todos("cartoes", "*, bancos(nome)");
const { data: cx } = await db.from("caixinhas").select("valor_mensal, inicio, fim").eq("grupo_id", GRUPO);
const { data: prefsRows } = await db.from("preferencias").select("*").limit(5);
const meta = (cx ?? []).filter((c: any) => c.inicio.slice(0, 7) <= mes && (!c.fim || c.fim.slice(0, 7) >= mes)).reduce((s: number, c: any) => s + Number(c.valor_mensal), 0);
const diaVirada = 15;
const cotacao = { USD: 5.5, EUR: 6 };
const n = calcularNumerosCiclo({ despesas, receitas, faturas, cotacao, cartoes, mostrarFaturaAberta: true, somarPagamentoFatura: false }, mes, meta, diaVirada);

// Tela Despesas (como está hoje)
const lanc = lancamentosDoCiclo(despesas, mes, diaVirada, { incluirEconomia: true, cartoes });
const porDesp = new Map(lanc.map((p: any) => [p.despesa_id, p]));
let totalTela = 0, somaTodasParcelas = 0, credito = 0, pagFatura = 0, economia = 0;
for (const d of despesas) {
  if (!porDesp.has(d.id) || d.economia_conquistada) continue;
  totalTela += Number(porDesp.get(d.id)!.valor);
}
for (const p of lanc as any[]) {
  if (p.despesa?.economia_conquistada) { economia += Number(p.valor); continue; }
  somaTodasParcelas += Number(p.valor);
  if (p.despesa?.direcao === "credito") credito += Number(p.valor);
  else if (!contaComoDespesa(p.despesa, false)) pagFatura += Number(p.valor);
}
const recTelaDespesas = receitasPorCompetencias(receitas, [mes]).reduce((s: number, r: any) => s + Number(r.valor), 0);
const recCiclo = receitasDoCiclo(receitas, mes, diaVirada).reduce((s: number, r: any) => s + Number(r.valor), 0);
const j = janelasDoCiclo(mes, diaVirada);
console.log(JSON.stringify({
  ciclo: j.rotulo,
  telaDespesas: { totalDespesas: r2(totalTela), somaDeTodasAsParcelasDoCiclo: r2(somaTodasParcelas), receitasPorCompetencia: r2(recTelaDespesas) },
  regraUnica: {
    receitas: n.previsto.receitas, receitasDoCiclo: r2(recCiclo), despesas: n.previsto.despesas, faturaEstimada: n.previsto.faturaEstimada,
    despesasSemEstimativa: r2(n.previsto.despesas - n.previsto.faturaEstimada), caixinhas: n.previsto.caixinhas, sobra: n.previsto.sobra,
    emContaAgora: n.real.sobra, realReceitas: n.real.receitas, realDespesas: n.real.despesas,
  },
  diferencasDespesas: { credito: r2(credito), pagamentoFatura: r2(pagFatura), economia: r2(economia) },
  ritmo: previsaoPeloRitmo({ despesas, receitas, faturas, cotacao, cartoes, somarPagamentoFatura: false }, mes, n, diaVirada),
  estimativas: n.estimativas,
  prefsLinhas: (prefsRows ?? []).length,
}, null, 1));
