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
  serie: { dia: number; saldo: number; projetado: boolean }[];
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
    serie.push({ dia: d, saldo: r2(acc), projetado });
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

export function calcularPrevisaoMes(
  dados: { despesas: any[]; receitas: any[]; faturas: any[]; cotacao: any },
  mes: string,
  metaPoupar = 0,
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
  const recMes = recProj.filter((r: any) => r.competencia === mes);
  const parcMes = parcelas.filter((p: any) => monthKey(p.vencimento) === mes);
  const [ano = 1970, m = 1] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const diaHoje = mes === mesHoje ? hoje.getDate() : mes < mesHoje ? diasNoMes : 0;
  const ent = new Array(diasNoMes + 1).fill(0);
  const sai = new Array(diasNoMes + 1).fill(0);
  // Dia pela data em texto (sem fuso): lançamento com data fora do mês cai no dia 1.
  const diaNoMes = (iso: unknown) => {
    const k = String(iso ?? "").slice(0, 10);
    return k.slice(0, 7) === mes ? Math.min(diasNoMes, Math.max(1, Number(k.slice(8, 10)) || 1)) : 1;
  };
  for (const r of recMes) ent[diaNoMes((r as any).data_recebimento)] += vr(r);
  for (const p of parcMes) sai[diaNoMes((p as any).vencimento)] += v(p);
  const diaRitmo = hoje.getDate();
  let gastoVarAteHoje = 0;
  for (const d of despesas) {
    if (d.recorrencia_inicio || d.tipo === "fixa" || d.direcao === "credito") continue;
    const k = String(d.data_compra ?? "").slice(0, 10);
    if (k.slice(0, 7) !== mesHoje || Number(k.slice(8, 10)) > diaRitmo) continue;
    const partes = Math.max(1, Number(d.total_parcelas) || 1);
    gastoVarAteHoje += toBRL(Number(d.valor_total) / partes, d.moeda, cotacao);
  }
  const ritmoDiario = diaRitmo > 0 ? gastoVarAteHoje / diaRitmo : 0;
  return projetarMes({ diasNoMes, diaHoje, entradas: ent, saidas: sai, ritmoDiario, meta: metaPoupar, encerrado: mes < mesHoje });
}
