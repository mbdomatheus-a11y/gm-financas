import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { toBRL, competenciaAtual } from "@/lib/format";
import { lancamentosPorCompetencias, receitasPorCompetencias, somarMeses } from "@/lib/recorrencia";
import { contaComoDespesa, totaisInvestimentos, type MovimentoInvestimento } from "@/lib/regras-saldo";

/**
 * NÚMEROS DO CICLO (07/11/2026): a ÚNICA função que calcula "sobra" no site e no app.
 * Site: src/lib/numeros-ciclo.ts. App: controlall/src/lib/numeros-ciclo.ts (cópia, mesma lógica).
 * Documentação: docs/numeros-ciclo.md. Nenhuma tela pode somar receitas menos despesas por conta própria.
 *
 * Período: SEMPRE o ciclo do usuário (dia de virada), nunca o mês do calendário.
 *
 * REAL ATÉ HOJE ("Sobra até agora")
 *   receitas já recebidas (lançadas, data de recebimento até hoje)
 *   − despesas já lançadas com vencimento no ciclo até hoje.
 * PREVISTO NO FIM DO CICLO
 *   receitas do ciclo (lançadas + fixas projetadas)
 *   − despesas do ciclo (lançadas + recorrentes projetadas + estimativa de fatura aberta)
 *   − caixinhas (valor a guardar no ciclo).
 *
 * Regra única para receitas do dia N em diante (preferência "receitas a partir do dia N, ex. 28, contam no
 * próximo ciclo"): vale a competência calculada por receitasPorCompetencias (r.competencia), que já aplica a
 * preferência uma vez. A regra NÃO é reaplicada sobre a data (antes, a fixa projetada do dia 28 era
 * empurrada duas vezes e sumia do ciclo em umas telas e aparecia em outras).
 */

export const ROTULO_SOBRA_REAL = "Sobra até agora";
export const ROTULO_SOBRA_PREVISTA = "Previsto no fim do ciclo";

/** Fatura de cartão ainda aberta e sem total informado: entra no previsto pela média das últimas faturas. */
export type EstimativaFatura = {
  cartaoId: string;
  nome: string;
  /** Já lançado (compras e parcelas) com vencimento neste ciclo. */
  real: number;
  /** Média das últimas faturas do cartão. */
  media: number;
  /** O que foi somado ao previsto (média − real). */
  extra: number;
};

export type DadosCiclo = {
  despesas: any[];
  receitas: any[];
  faturas: any[];
  cotacao: any;
  cartoes?: any[];
  /** Regra "Mostrar fatura aberta": false tira a estimativa das faturas abertas. Padrão true. */
  mostrarFaturaAberta?: boolean;
  /** Regra "Somar pagamento de fatura": sem ela (padrão), pagamento de fatura não entra nas saídas. */
  somarPagamentoFatura?: boolean;
  /** Regra "Somar investimentos": movimentos (aportes saem, resgates entram). Só quando a regra está ligada. */
  movimentosInvestimento?: MovimentoInvestimento[] | null;
};

export type NumerosCiclo = {
  mes: string;
  inicio: string;
  fim: string;
  hoje: string;
  encerrado: boolean;
  /** Ciclo ainda não começou. */
  futuro: boolean;
  diasNoCiclo: number;
  /** Posição de hoje no ciclo (0 = ainda não começou, diasNoCiclo = já terminou). */
  diaHoje: number;
  /** Dias que faltam, contando hoje. */
  diasRestantes: number;
  /** REAL ATÉ HOJE. */
  real: { receitas: number; despesas: number; sobra: number };
  /** PREVISTO NO FIM DO CICLO. */
  previsto: {
    receitas: number;
    despesas: number;
    caixinhas: number;
    sobra: number;
    /** Receitas previstas que ainda não entraram (previsto − real). */
    aindaVaoEntrar: number;
    /** Despesas previstas que ainda não venceram (previsto − real), já com a fatura estimada. */
    aindaVaoVencer: number;
    /** Parte de aindaVaoVencer que é estimativa de fatura aberta. */
    faturaEstimada: number;
  };
  estimativas: EstimativaFatura[];
  /** O REAL, se positivo. Para uso futuro (investir a sobra). */
  sobraParaInvestir: number;
  /** Previsto livre dividido pelos dias restantes (0 se não sobra nada). */
  porDia: number;
  /** Saldo acumulado dia a dia (sem caixinhas): real até hoje, previsto depois. dia = posição (1..N). */
  serie: { dia: number; rotulo: number; saldo: number; projetado: boolean }[];
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Data (AAAA-MM-DD) do fechamento da fatura que vence em `venc`: o último dia `diaFech` antes do vencimento. */
export function fechamentoDaFatura(venc: string, diaFech: number | null | undefined): string {
  const [a = 1970, m = 1, d = 1] = venc.split("-").map(Number);
  const fmt = (x: Date) => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  if (!diaFech) return fmt(new Date(a, m - 1, d - 7));
  const diaNoMes = (ano: number, mes0: number) => Math.min(diaFech, new Date(ano, mes0 + 1, 0).getDate());
  let x = new Date(a, m - 1, diaNoMes(a, m - 1));
  if (x.getDate() >= d) x = new Date(a, m - 2, diaNoMes(a, m - 2));
  return fmt(x);
}

/**
 * Ciclo da competência pelo dia de virada: com virada D, a competência "AAAA-MM" vai de D/MM até D-1 do mês
 * seguinte. Sem virada, é o mês do calendário. Devolve as datas do ciclo (AAAA-MM-DD) em ordem.
 */
export function datasDoCiclo(mes: string, diaVirada?: number | null): string[] {
  const [ano = 1970, m = 1] = mes.split("-").map(Number);
  const d = diaVirada && diaVirada >= 2 && diaVirada <= 28 ? diaVirada : 1;
  const inicio = new Date(ano, m - 1, d);
  const fim = d === 1 ? new Date(ano, m, 0) : new Date(ano, m, d - 1);
  const out: string[] = [];
  for (const x = new Date(inicio); x <= fim; x.setDate(x.getDate() + 1)) {
    out.push(`${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`);
  }
  return out;
}

/** Competência (AAAA-MM) em que a data cai, pelo dia de virada. */
export function competenciaDaData(iso: string, diaVirada?: number | null): string {
  const d = diaVirada && diaVirada >= 2 && diaVirada <= 28 ? diaVirada : 1;
  const [a = 1970, m = 1, dia = 1] = iso.split("-").map(Number);
  if (dia >= d) return `${a}-${pad2(m)}`;
  const ant = new Date(a, m - 2, 1);
  return `${ant.getFullYear()}-${pad2(ant.getMonth() + 1)}`;
}

/** O REAL (sobra até agora) se positivo; senão 0. */
export function sobraParaInvestir(n: Pick<NumerosCiclo, "real">): number {
  return n.real.sobra > 0 ? n.real.sobra : 0;
}

/** Linha pequena sob o destaque: "Previsto no fim do ciclo: R$ X". */
export function textoPrevisto(n: NumerosCiclo, formatar: (v: number) => string): string {
  return `${ROTULO_SOBRA_PREVISTA}: ${formatar(n.previsto.sobra)}`;
}

/** Explica a diferença entre o previsto e o real, sempre com as mesmas palavras. */
export function textoDiferenca(n: NumerosCiclo, formatar: (v: number) => string): string {
  const p = n.previsto;
  const partes: string[] = [];
  if (p.aindaVaoEntrar >= 0.5) partes.push(`${formatar(p.aindaVaoEntrar)} que ainda vão entrar`);
  if (p.aindaVaoVencer >= 0.5) partes.push(`${formatar(p.aindaVaoVencer)} de contas que ainda vão vencer`);
  if (p.caixinhas >= 0.5) partes.push(`${formatar(p.caixinhas)} guardados nas caixinhas`);
  if (partes.length === 0) return "Igual ao que já aconteceu no ciclo.";
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0];
  return `Inclui ${lista}.`;
}

type BaseCiclo = { parcelas: any[]; recProj: any[] };

/** Lançamentos e receitas projetados numa janela que cobre todos os `meses` pedidos (calculado uma vez). */
function montarBase(dados: DadosCiclo, meses: string[], agora: Date): BaseCiclo {
  const mesHoje = competenciaAtual(agora);
  const janela = new Set<string>();
  for (let i = -12; i <= 24; i++) janela.add(somarMeses(mesHoje, i));
  for (const mes of meses) for (let i = -3; i <= 1; i++) janela.add(somarMeses(mes, i));
  const lista = [...janela].sort();
  return {
    parcelas: aplicarRegrasFaturaMes(lancamentosPorCompetencias(dados.despesas, lista), dados.faturas) as any[],
    recProj: receitasPorCompetencias(dados.receitas, lista) as any[],
  };
}

/** Números de UM ciclo. */
export function calcularNumerosCiclo(
  dados: DadosCiclo,
  mes: string,
  metaCaixinhas = 0,
  diaVirada?: number | null,
  agora: Date = new Date(),
): NumerosCiclo {
  return calcularComBase(dados, montarBase(dados, [mes], agora), mes, metaCaixinhas, diaVirada, agora);
}

/** Números de VÁRIOS ciclos (gráficos mês a mês), montando a base uma vez. Mesma conta de calcularNumerosCiclo. */
export function calcularNumerosDosCiclos(
  dados: DadosCiclo,
  meses: string[],
  metaDe: (mes: string) => number,
  diaVirada?: number | null,
  agora: Date = new Date(),
): Map<string, NumerosCiclo> {
  const base = montarBase(dados, meses, agora);
  return new Map(meses.map((m) => [m, calcularComBase(dados, base, m, metaDe(m), diaVirada, agora)]));
}

function calcularComBase(
  dados: DadosCiclo,
  base: BaseCiclo,
  mes: string,
  metaCaixinhas: number,
  diaVirada: number | null | undefined,
  agora: Date,
): NumerosCiclo {
  const { faturas, cotacao } = dados;
  const meta = Math.max(0, Number(metaCaixinhas) || 0);
  const { parcelas, recProj } = base;
  const v = (p: any) => toBRL(Number(p.valor), p.despesa.moeda, cotacao);
  const vr = (r: any) => toBRL(Number(r.valor), r.moeda, cotacao);

  const datas = datasDoCiclo(mes, diaVirada);
  const indice = new Map(datas.map((d, i) => [d, i + 1]));
  const dias = datas.length;
  const hojeIso = `${agora.getFullYear()}-${pad2(agora.getMonth() + 1)}-${pad2(agora.getDate())}`;
  const encerrado = hojeIso > datas[dias - 1]!;
  const futuro = hojeIso < datas[0]!;
  const diaHoje = indice.get(hojeIso) ?? (encerrado ? dias : 0);
  const posicao = (iso: string) => indice.get(iso) ?? (iso < datas[0]! ? 1 : dias);

  // entradas/saídas por dia: "prev" = tudo do ciclo, "real" = só o que já aconteceu até hoje.
  const entPrev = new Array(dias + 1).fill(0);
  const saiPrev = new Array(dias + 1).fill(0);
  const entReal = new Array(dias + 1).fill(0);
  const saiReal = new Array(dias + 1).fill(0);
  let recPrev = 0;
  let desPrev = 0;
  let recReal = 0;
  let desReal = 0;

  // Receitas: pertencem ao ciclo pela competência (regra única, ver cabeçalho).
  for (const r of recProj) {
    if (r.competencia !== mes) continue;
    const iso = String(r.data_recebimento ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const val = vr(r);
    const i = posicao(iso);
    recPrev += val;
    entPrev[i] += val;
    if (!r.projetada && iso <= hojeIso) {
      recReal += val;
      entReal[i] += val;
    }
  }
  // Despesas: parcelas com vencimento dentro do ciclo. Crédito (estorno) e pagamento de fatura (regra) ficam fora.
  for (const p of parcelas) {
    if (p.despesa?.direcao === "credito") continue;
    if (!contaComoDespesa(p.despesa, dados.somarPagamentoFatura)) continue;
    const iso = String(p.vencimento ?? "").slice(0, 10);
    const i = indice.get(iso);
    if (!i) continue;
    const val = v(p);
    desPrev += val;
    saiPrev[i] += val;
    if (!p.projetada && iso <= hojeIso) {
      desReal += val;
      saiReal[i] += val;
    }
  }
  // Investimentos (regra "Somar investimentos"): aporte sai, resgate entra, pela data do movimento.
  if (dados.movimentosInvestimento?.length) {
    const noCiclo = new Set(datas);
    for (const m of dados.movimentosInvestimento) {
      if (!noCiclo.has(m.data)) continue;
      const i = indice.get(m.data)!;
      const entrada = totaisInvestimentos([m], () => true).entradas > 0;
      const feito = m.data <= hojeIso;
      if (entrada) {
        recPrev += m.valor;
        entPrev[i] += m.valor;
        if (feito) { recReal += m.valor; entReal[i] += m.valor; }
      } else {
        desPrev += m.valor;
        saiPrev[i] += m.valor;
        if (feito) { desReal += m.valor; saiReal[i] += m.valor; }
      }
    }
  }

  // Fatura de cartão ainda aberta (fechamento no futuro) e sem total informado em "Fatura do mês":
  // entra pela média das últimas faturas, no lugar do que já foi lançado. Precisa de 2+ faturas no histórico.
  const estimativas: EstimativaFatura[] = [];
  if (!encerrado && Array.isArray(dados.cartoes) && dados.mostrarFaturaAberta !== false) {
    const noCiclo = new Set(datas);
    const soma = (lista: any[], set: Set<string>) =>
      lista.reduce((s, p) => (set.has(String(p.vencimento ?? "").slice(0, 10)) ? s + v(p) : s), 0);
    for (const c of dados.cartoes as any[]) {
      if (c.tipo && c.tipo !== "credito") continue;
      if (faturas.some((f: any) => f.cartao_id === c.id && f.competencia === mes && f.modo_calculo === "somente_total")) continue;
      const doCartao = parcelas.filter(
        (p) => p.despesa?.cartao_id === c.id && p.despesa?.direcao !== "credito" && contaComoDespesa(p.despesa, dados.somarPagamentoFatura),
      );
      const noPeriodo = doCartao.filter((p) => noCiclo.has(String(p.vencimento ?? "").slice(0, 10)));
      const real = soma(doCartao, noCiclo);
      const vencs = [...new Set(noPeriodo.map((p) => String(p.vencimento).slice(0, 10)))];
      const abertas = vencs.length === 0 || vencs.some((venc) => hojeIso <= fechamentoDaFatura(venc, c.dia_fechamento));
      if (!abertas) continue;
      if (noPeriodo.length > 0 && noPeriodo.every((p) => p.paga)) continue;
      const hist: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const s = soma(doCartao, new Set(datasDoCiclo(somarMeses(mes, -i), diaVirada)));
        if (s > 0) hist.push(s);
      }
      if (hist.length < 2) continue;
      const media = hist.reduce((a, b) => a + b, 0) / hist.length;
      const extra = media - real;
      if (extra < 1) continue;
      const dia = Number(c.dia_vencimento) || 0;
      const pos = datas.findIndex((d) => Number(d.slice(8, 10)) === dia);
      saiPrev[(pos >= 0 ? pos : dias - 1) + 1] += extra;
      desPrev += extra;
      estimativas.push({
        cartaoId: String(c.id),
        nome: `${c.apelido ?? c.bandeira ?? "Cartão"}${c.final ? ` •${c.final}` : ""}`,
        real: r2(real),
        media: r2(media),
        extra: r2(extra),
      });
    }
  }
  const faturaEstimada = estimativas.reduce((s, e) => s + e.extra, 0);

  const sobraReal = recReal - desReal;
  const sobraPrevista = recPrev - desPrev - meta;

  // Série: real até hoje; depois, o previsto (o que ainda falta entra nos dias que faltam).
  let futuroLiquido = 0;
  for (let d = diaHoje + 1; d <= dias; d++) futuroLiquido += entPrev[d] - saiPrev[d];
  const pendenteAtrasado = recPrev - desPrev - sobraReal - futuroLiquido;
  const serie: NumerosCiclo["serie"] = [];
  let acc = 0;
  for (let d = 1; d <= dias; d++) {
    const projetado = d > diaHoje;
    if (!projetado) acc += entReal[d] - saiReal[d];
    else {
      if (d === diaHoje + 1) acc += pendenteAtrasado;
      acc += entPrev[d] - saiPrev[d];
    }
    serie.push({ dia: d, rotulo: Number(datas[d - 1]!.slice(8, 10)), saldo: r2(acc), projetado });
  }
  const diasRestantes = encerrado ? 0 : diaHoje === 0 ? dias : dias - diaHoje + 1;
  const porDia = diasRestantes > 0 && sobraPrevista > 0 ? sobraPrevista / diasRestantes : 0;

  const real = { receitas: r2(recReal), despesas: r2(desReal), sobra: r2(sobraReal) };
  return {
    mes,
    inicio: datas[0]!,
    fim: datas[dias - 1]!,
    hoje: hojeIso,
    encerrado,
    futuro,
    diasNoCiclo: dias,
    diaHoje,
    diasRestantes,
    real,
    previsto: {
      receitas: r2(recPrev),
      despesas: r2(desPrev),
      caixinhas: r2(meta),
      sobra: r2(sobraPrevista),
      aindaVaoEntrar: r2(recPrev - recReal),
      aindaVaoVencer: r2(desPrev - desReal),
      faturaEstimada: r2(faturaEstimada),
    },
    estimativas,
    sobraParaInvestir: sobraParaInvestir({ real }),
    porDia: r2(porDia),
    serie,
  };
}
