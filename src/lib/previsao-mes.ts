import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { monthKey, toBRL } from "@/lib/format";
import { lancamentosPorCompetencias, receitasPorCompetencias, somarMeses } from "@/lib/recorrencia";

/**
 * Previsão do mês: MESMA regra do app (controlall/src/lib/painel.ts, calcularPainel + projetarMes),
 * 27/10/2026, para site e app mostrarem o mesmo número.
 *  saldo livre = receitas do mês (com as recorrentes projetadas) − despesas que vencem no mês
 *                (parcelas, fixas, faturas) − valor a guardar nas caixinhas.
 *  fim do mês previsto = receitas − comprometido − ritmo dos gastos variáveis × dias que faltam.
 */
export type PrevisaoMes = {
  diasNoMes: number;
  diaHoje: number;
  receitas: number;
  comprometido: number;
  meta: number;
  saldoLivre: number;
  diasRestantes: number;
  porDia: number;
  ritmoDiario: number;
  gastoPrevisto: number;
  finalPrevisto: number;
  sobraPrevista: number;
  alerta: boolean;
  /** dia = posição no ciclo (1..N); rotulo = dia do mês para mostrar no gráfico. */
  serie: { dia: number; rotulo: number; saldo: number; projetado: boolean }[];
};

const r2 = (v: number) => Math.round(v * 100) / 100;

export function projetarMes(x: {
  diasNoMes: number;
  diaHoje: number;
  entradas: number[];
  saidas: number[];
  ritmoDiario: number;
  meta: number;
  encerrado?: boolean;
  rotulos?: number[];
}): PrevisaoMes {
  const { diasNoMes, diaHoje, entradas, saidas, ritmoDiario } = x;
  const meta = Math.max(0, x.meta);
  let receitas = 0;
  let comprometido = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    receitas += entradas[d] ?? 0;
    comprometido += saidas[d] ?? 0;
  }
  const passado = Boolean(x.encerrado);
  const diasFuturos = Math.max(0, diasNoMes - diaHoje);
  const diasRestantes = passado ? 0 : diaHoje === 0 ? diasNoMes : diasNoMes - diaHoje + 1;
  const saldoLivre = receitas - comprometido - meta;
  const porDia = diasRestantes > 0 && saldoLivre > 0 ? saldoLivre / diasRestantes : 0;
  const ritmo = passado ? 0 : ritmoDiario;
  const gastoPrevisto = ritmo * diasFuturos;
  const finalPrevisto = receitas - comprometido - gastoPrevisto;
  const sobraPrevista = finalPrevisto - meta;
  const serie: PrevisaoMes["serie"] = [];
  let acc = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const projetado = d > diaHoje;
    acc += (entradas[d] ?? 0) - (saidas[d] ?? 0) - (projetado ? ritmo : 0);
    serie.push({ dia: d, rotulo: x.rotulos?.[d - 1] ?? d, saldo: r2(acc), projetado });
  }
  return {
    diasNoMes,
    diaHoje,
    receitas: r2(receitas),
    comprometido: r2(comprometido),
    meta: r2(meta),
    saldoLivre: r2(saldoLivre),
    diasRestantes,
    porDia: r2(porDia),
    ritmoDiario: r2(ritmo),
    gastoPrevisto: r2(gastoPrevisto),
    finalPrevisto: r2(finalPrevisto),
    sobraPrevista: r2(sobraPrevista),
    alerta: finalPrevisto < 0 || (meta > 0 && finalPrevisto < meta),
    serie,
  };
}

/**
 * Ciclo da competência pelo dia de virada (30/10/2026): com virada D, a competência "AAAA-MM" vai de D/MM
 * até D-1 do mês seguinte (mesma regra do "mês do sistema"). Sem virada, é o mês do calendário.
 * Devolve as datas do ciclo (AAAA-MM-DD) em ordem.
 */
export function datasDoCiclo(mes: string, diaVirada?: number | null): string[] {
  const [ano = 1970, m = 1] = mes.split("-").map(Number);
  const d = diaVirada && diaVirada >= 2 && diaVirada <= 28 ? diaVirada : 1;
  const inicio = new Date(ano, m - 1, d);
  const fim = d === 1 ? new Date(ano, m, 0) : new Date(ano, m, d - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (const x = new Date(inicio); x <= fim; x.setDate(x.getDate() + 1)) {
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`);
  }
  return out;
}

/** Ciclo em que a receita conta: o da data ou, com a opção ligada e na faixa "dia N até a virada", o seguinte. */
export function cicloDaReceita(iso: string, diaVirada?: number | null, aPartirDoDia?: number | null): string {
  const ciclo = competenciaDaData(iso, diaVirada);
  const n = aPartirDoDia && aPartirDoDia >= 1 && aPartirDoDia <= 31 ? aPartirDoDia : null;
  if (!n) return ciclo;
  const d = diaVirada && diaVirada >= 2 && diaVirada <= 28 ? diaVirada : 1;
  const dia = Number(iso.slice(8, 10));
  const naFaixa = n >= d ? dia >= n || dia < d : dia >= n && dia < d;
  if (!naFaixa) return ciclo;
  const [a, m] = ciclo.split("-").map(Number);
  const prox = new Date(a, m, 1);
  return `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}`;
}

/** Competência (AAAA-MM) em que a data cai, pelo dia de virada. */
function competenciaDaData(iso: string, diaVirada?: number | null): string {
  const d = diaVirada && diaVirada >= 2 && diaVirada <= 28 ? diaVirada : 1;
  const [a, m, dia] = iso.split("-").map(Number);
  if (dia >= d) return `${a}-${String(m).padStart(2, "0")}`;
  const ant = new Date(a, m - 2, 1);
  return `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, "0")}`;
}

export function calcularPrevisaoMes(
  dados: { despesas: any[]; receitas: any[]; faturas: any[]; cotacao: any },
  mes: string,
  metaPoupar = 0,
  diaVirada?: number | null,
  receitasProximoCicloDia?: number | null,
): PrevisaoMes {
  const { despesas, receitas, faturas, cotacao } = dados;
  const hoje = new Date();
  const mesHoje = monthKey(hoje);
  const janela = new Set<string>();
  for (let i = -12; i <= 24; i++) janela.add(somarMeses(mesHoje, i));
  for (let i = -3; i <= 1; i++) janela.add(somarMeses(mes, i));
  const meses = [...janela].sort();
  const parcelas = aplicarRegrasFaturaMes(lancamentosPorCompetencias(despesas, meses), faturas);
  const recProj = receitasPorCompetencias(receitas, meses);
  const v = (p: any) => toBRL(Number(p.valor), p.despesa.moeda, cotacao);
  const vr = (r: any) => toBRL(Number(r.valor), r.moeda, cotacao);
  // 30/10/2026: a previsão segue o ciclo do dia de virada (ex.: 25/10 a 24/11), não o mês do calendário.
  const datas = datasDoCiclo(mes, diaVirada);
  const indice = new Map(datas.map((d, i) => [d, i + 1]));
  const diasNoMes = datas.length;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const hojeIso = `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-${pad2(hoje.getDate())}`;
  const encerrado = hojeIso > datas[datas.length - 1]!;
  const diaHoje = indice.get(hojeIso) ?? (encerrado ? diasNoMes : 0);
  const ent = new Array(diasNoMes + 1).fill(0);
  const sai = new Array(diasNoMes + 1).fill(0);
  // Receita conta no ciclo da data; com a opção "a partir do dia N", a que cai entre o dia N e a virada
  // vai para o próximo ciclo (ex.: salário do dia 30 paga o ciclo que começa na próxima virada).
  for (const r of recProj as any[]) {
    const iso = String(r.data_recebimento ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    if (cicloDaReceita(iso, diaVirada, receitasProximoCicloDia) !== mes) continue;
    ent[indice.get(iso) ?? 1] += vr(r);
  }
  for (const p of parcelas as any[]) {
    const i = indice.get(String(p.vencimento ?? "").slice(0, 10));
    if (i) sai[i] += v(p);
  }
  // Ritmo dos variáveis: ciclo vigente até hoje (também usado para projetar ciclos futuros).
  const cicloHoje = datasDoCiclo(competenciaDaData(hojeIso, diaVirada), diaVirada);
  const diaRitmo = Math.max(1, cicloHoje.indexOf(hojeIso) + 1);
  let gastoVarAteHoje = 0;
  for (const d of despesas) {
    if (d.recorrencia_inicio || d.tipo === "fixa" || d.direcao === "credito" || d.economia_conquistada) continue;
    const k = String(d.data_compra ?? "").slice(0, 10);
    if (k < cicloHoje[0]! || k > hojeIso) continue;
    const partes = Math.max(1, Number(d.total_parcelas) || 1);
    gastoVarAteHoje += toBRL(Number(d.valor_total) / partes, d.moeda, cotacao);
  }
  const ritmoDiario = gastoVarAteHoje / diaRitmo;
  const rotulos = datas.map((d) => Number(d.slice(8, 10)));
  return projetarMes({ diasNoMes, diaHoje, entradas: ent, saidas: sai, ritmoDiario, meta: metaPoupar, encerrado, rotulos });
}
