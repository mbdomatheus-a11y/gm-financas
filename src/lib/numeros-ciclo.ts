import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { toBRL, competenciaAtual } from "@/lib/format";
import { lancamentosPorCompetencias, receitasPorCompetencias, somarMeses } from "@/lib/recorrencia";
import { contaComoDespesa, totaisInvestimentos, type MovimentoInvestimento } from "@/lib/regras-saldo";

/**
 * NÚMEROS DO CICLO: a ÚNICA função que calcula "sobra" no site e no app.
 * Site: src/lib/numeros-ciclo.ts. App: controlall/src/lib/numeros-ciclo.ts (cópia, mesma lógica).
 * Documentação: docs/numeros-ciclo.md. Nenhuma tela pode somar receitas menos despesas por conta própria.
 *
 * REGRA ÚNICA DO CICLO (versão final do usuário, 09/11/2026, docs/regra-ciclo-2026-11-08.md):
 * O ciclo "AAAA-MM" (mês M, ex. "2026-10") com virada D (ex. 15) vai de D+1/M a D/M+1 (16/out a 15/nov,
 * o "ciclo de novembro"); aparece até o dia D e vira no dia D+1.
 *   RECEITAS pela DATA PREVISTA de D+1/M até D/M+1 (salário de 30/out e de 15/nov; o do dia 15 pertence ao
 *     ciclo que TERMINA no dia 15). Atrasada conta na data prevista; avulsa pela data em que entrou.
 *   FATURAS de cartão pelo FECHAMENTO em qualquer dia do mês M+1 (fecha 07/nov, 28/nov: entram; fechou em
 *     outubro: ciclo anterior, mesmo vencendo depois de 15/out).
 *   CONTAS fora do cartão pelo VENCIMENTO de D+1/M até D/M+1.
 *   Linha: "Receitas de 16/out a 15/nov · faturas que fecham em novembro · contas que vencem de 16/out a 15/nov".
 * DISPONÍVEL ATÉ HOJE = receitas do ciclo já recebidas (fixa: data prevista chegou; avulsa: lançada) − despesas
 *   do ciclo já vencidas (vencimento até hoje).
 * PREVISTO PARA SOBRAR = Disponível + o que ainda vai entrar − o que ainda vai vencer − caixinhas do ciclo.
 * Sem forecast por ritmo. A regra substitui, para a sobra, a antiga "receitas a partir do dia N".
 * D vem da regra do grupo (regra_ciclo_grupo); sem regra, da virada antiga das preferências.
 */

export const ROTULO_SOBRA_REAL = "Em conta agora";
export const ROTULO_SOBRA_PREVISTA = "Previsto para sobrar";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11-15" → "15/nov". */
export function diaMesCurto(iso: string): string {
  return `${iso.slice(8, 10)}/${MESES_CURTOS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)}`;
}

/** "2026-11-15" → "15/11". */
export function diaMesNum(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export type JanelasCiclo = {
  mes: string;
  /** Primeiro dia do ciclo (dia D, receitas começam). */
  inicio: string;
  /** Último dia do ciclo (dia D do mês seguinte, última data de vencimento). */
  fim: string;
  receitas: { inicio: string; fim: string };
  /** Contas fora do cartão: vencimento de D+1/M até D/M+1. */
  despesas: { inicio: string; fim: string };
  /** Faturas de cartão: fechamento no mês M+1 inteiro (com virada). Sem virada: vencimento no mês. */
  faturas: { inicio: string; fim: string; porFechamento: boolean };
  /** "16/out a 15/nov". */
  rotulo: string;
  /** "Receitas de 16/out a 15/nov · faturas que fecham em novembro · contas que vencem de 16/out a 15/nov". */
  descricao: string;
};

function isoDe(x: Date): string {
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function diaValido(d: number | null | undefined): number | null {
  return d && d >= 1 && d <= 28 ? Math.trunc(d) : null;
}

/** Janelas do ciclo "AAAA-MM" pela regra única. Sem virada: mês do calendário para receitas e despesas. */
export function janelasDoCiclo(mes: string, diaVirada?: number | null): JanelasCiclo {
  const [ano = 1970, m = 1] = mes.split("-").map(Number);
  const d = diaValido(diaVirada);
  if (!d) {
    const ini = isoDe(new Date(ano, m - 1, 1));
    const fim = isoDe(new Date(ano, m, 0));
    return {
      mes,
      inicio: ini,
      fim,
      receitas: { inicio: ini, fim },
      despesas: { inicio: ini, fim },
      faturas: { inicio: ini, fim, porFechamento: false },
      rotulo: `${diaMesCurto(ini)} a ${diaMesCurto(fim)}`,
      descricao: `Receitas, contas e faturas de ${MESES_LONGOS[m - 1] ?? mes}`,
    };
  }
  const ini = isoDe(new Date(ano, m - 1, d + 1));
  const fim = isoDe(new Date(ano, m, d));
  // Faturas de cartão: fechamento no mês seguinte inteiro (M+1).
  const fatIni = isoDe(new Date(ano, m, 1));
  const fatFim = isoDe(new Date(ano, m + 1, 0));
  const rotulo = `${diaMesCurto(ini)} a ${diaMesCurto(fim)}`;
  return {
    mes,
    inicio: ini,
    fim,
    receitas: { inicio: ini, fim },
    despesas: { inicio: ini, fim },
    faturas: { inicio: fatIni, fim: fatFim, porFechamento: true },
    rotulo,
    descricao: `Receitas de ${rotulo} · faturas que fecham em ${MESES_LONGOS[new Date(ano, m, 1).getMonth()]} · contas que vencem de ${rotulo}`,
  };
}

/** Competência do ciclo em andamento hoje: até o dia D vale o ciclo que termina; a partir de D+1, o novo. */
export function mesDoCicloEm(agora: Date, diaVirada?: number | null): string {
  const d = diaValido(diaVirada);
  const ref = d && agora.getDate() <= d ? new Date(agora.getFullYear(), agora.getMonth() - 1, 1) : agora;
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}

function diasEntre(a: string, b: string): number {
  const ta = new Date(`${a}T12:00:00`).getTime();
  const tb = new Date(`${b}T12:00:00`).getTime();
  return Math.round((tb - ta) / 86400000);
}

export type CicloResumo = JanelasCiclo & { diasRestantes: number; texto: string };

/** Ciclo atual: início, fim, rótulo "15/nov a 15/dez", dias restantes e "15/nov a 15/dez · faltam N dias". */
export function cicloAtual(diaVirada?: number | null, agora: Date = new Date()): CicloResumo {
  const j = janelasDoCiclo(mesDoCicloEm(agora, diaVirada), diaVirada);
  const diasRestantes = Math.max(0, diasEntre(isoDe(agora), j.fim));
  return { ...j, diasRestantes, texto: textoCiclo(j, diasRestantes) };
}

/** Ciclo anterior (já fechado) ao ciclo atual. */
export function cicloAnterior(diaVirada?: number | null, agora: Date = new Date()): CicloResumo {
  const j = janelasDoCiclo(somarMeses(mesDoCicloEm(agora, diaVirada), -1), diaVirada);
  return { ...j, diasRestantes: 0, texto: j.rotulo };
}

export function textoCiclo(j: Pick<JanelasCiclo, "rotulo">, diasRestantes: number): string {
  if (diasRestantes <= 0) return `${j.rotulo} · último dia`;
  return `${j.rotulo} · ${diasRestantes === 1 ? "falta 1 dia" : `faltam ${diasRestantes} dias`}`;
}

/** Data prevista de uma receita: fixa pela data prevista (atrasada ou adiantada conta na prevista); avulsa pela data real. */
export function dataPrevistaReceita(r: any): string {
  const real = String(r?.data_recebimento ?? "").slice(0, 10);
  if (r?.projetada) return real;
  const orig = r?.receitaOriginal ?? r;
  const informada = String(orig?.data_prevista ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(informada)) return informada;
  const recorrente = Boolean(r?.recorrente ?? orig?.recorrente);
  const inicio = String(orig?.recorrencia_inicio ?? "").slice(0, 10);
  if (!recorrente || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(real)) return real;
  // Mesmo dia usado na projeção (vencimentoDaCompetencia): 29, 30 e 31 viram o último dia em mês menor.
  const dia = Math.max(1, Math.min(31, Number(inicio.slice(8, 10)) || 1));
  const [a = 1970, m = 1] = real.split("-").map(Number);
  let melhor = real;
  let dist = Infinity;
  for (let k = -1; k <= 1; k++) {
    const c = isoDe(new Date(a, m - 1 + k, Math.min(dia, new Date(a, m + k, 0).getDate())));
    const dd = Math.abs(diasEntre(c, real));
    if (dd < dist) {
      dist = dd;
      melhor = c;
    }
  }
  return dist <= 16 ? melhor : real;
}

function chaveReceita(r: any): string {
  return `${String(r?.descricao ?? "").toLowerCase().trim()}::${String(r?.responsavel ?? "").toLowerCase().trim()}::${r?.frequencia ?? "mensal"}`;
}

/** Receitas (já projetadas) cuja data prevista cai na janela. Tira a projeção quando a lançada já ocupa a mesma data prevista. */
export function filtrarReceitasNaJanela<T>(lista: T[], inicio: string, fim: string): (T & { data_prevista_ciclo: string })[] {
  const dentro = (lista as any[])
    .map((r) => ({ ...r, data_prevista_ciclo: dataPrevistaReceita(r) }))
    .filter((r) => r.data_prevista_ciclo >= inicio && r.data_prevista_ciclo <= fim);
  const ocupadas = new Set(dentro.filter((r) => !r.projetada && r.recorrente).map((r) => `${chaveReceita(r)}@${r.data_prevista_ciclo}`));
  const vistas = new Set<string>();
  return dentro.filter((r) => {
    if (!r.projetada) {
      const id = `id:${r.id}`;
      if (vistas.has(id)) return false;
      vistas.add(id);
      return true;
    }
    const k = `${chaveReceita(r)}@${r.data_prevista_ciclo}`;
    if (ocupadas.has(k) || vistas.has(k)) return false;
    vistas.add(k);
    return true;
  }) as any;
}

/** Receitas do ciclo pela regra única (telas Receitas e numeros-ciclo usam a mesma janela). */
export function receitasDoCiclo(receitas: any[], mes: string, diaVirada?: number | null) {
  const j = janelasDoCiclo(mes, diaVirada);
  const comps = [somarMeses(mes, -1), mes, somarMeses(mes, 1)];
  return filtrarReceitasNaJanela(receitasPorCompetencias(receitas, comps), j.receitas.inicio, j.receitas.fim);
}

/** Fechamento da fatura da parcela, se ela é de cartão de crédito; null para conta fora do cartão. */
export function fechamentoDaParcela(p: any, cartoes?: any[] | null): string | null {
  const venc = String(p?.vencimento ?? "").slice(0, 10);
  const cartaoId = p?.despesa?.cartao_id ?? p?.cartao_id;
  if (!cartaoId || !/^\d{4}-\d{2}-\d{2}$/.test(venc)) return null;
  const c = (cartoes ?? []).find((x: any) => x?.id === cartaoId);
  if (c?.tipo && c.tipo !== "credito") return null;
  return fechamentoDaFatura(venc, c?.dia_fechamento ?? null);
}

/**
 * A parcela é despesa do ciclo? Fatura de cartão: FECHAMENTO no mês M+1. Conta fora do cartão:
 * VENCIMENTO de D+1/M até D/M+1. Sem virada: vencimento no mês do calendário.
 */
export function despesaNoCiclo(p: any, j: Pick<JanelasCiclo, "despesas" | "faturas">, cartoes?: any[] | null): boolean {
  const fech = j.faturas.porFechamento ? fechamentoDaParcela(p, cartoes) : null;
  if (fech) return fech >= j.faturas.inicio && fech <= j.faturas.fim;
  const iso = String(p?.vencimento ?? "").slice(0, 10);
  return iso >= j.despesas.inicio && iso <= j.despesas.fim;
}

/** Lançamentos de despesa do ciclo pela regra única (faturas que fecham em M+1 e contas que vencem no ciclo). */
export function lancamentosDoCiclo(
  despesas: any[],
  mes: string,
  diaVirada?: number | null,
  opcoes: { incluirEconomia?: boolean; cartoes?: any[] | null } = {},
) {
  const j = janelasDoCiclo(mes, diaVirada);
  const comps = [-1, 0, 1, 2].map((i) => somarMeses(mes, i));
  return lancamentosPorCompetencias(despesas, comps, { incluirEconomia: Boolean(opcoes.incluirEconomia) }).filter((p) =>
    despesaNoCiclo(p, j, opcoes.cartoes),
  );
}

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
  /** Dia D (receitas começam). */
  inicio: string;
  /** Dia D do mês seguinte (último vencimento do ciclo). */
  fim: string;
  /** "15/nov a 15/dez". */
  rotulo: string;
  /** "15/nov a 15/dez · faltam N dias". */
  textoCiclo: string;
  janelas: JanelasCiclo;
  /** Dias até o fim do ciclo (fim − hoje). */
  diasAteFim: number;
  hoje: string;
  encerrado: boolean;
  /** Ciclo ainda não começou. */
  futuro: boolean;
  diasNoCiclo: number;
  /** Posição de hoje no ciclo (0 = ainda não começou, diasNoCiclo = já terminou). */
  diaHoje: number;
  /** Dias que faltam, contando hoje. */
  diasRestantes: number;
  /** DISPONÍVEL ATÉ HOJE (recebidas − vencidas). */
  real: { receitas: number; despesas: number; sobra: number };
  /** PREVISTO PARA SOBRAR no fim do ciclo. */
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
  /** Previsto para sobrar dividido pelos dias restantes (incluindo hoje). Nunca negativo: 0 se não sobra nada. */
  porDia: number;
  /** Quanto falta para fechar o ciclo no zero (previsto negativo, em positivo). 0 se o previsto é >= 0. */
  faltaParaFechar: number;
  /** Saldo acumulado dia a dia (sem caixinhas): real até hoje, previsto depois. dia = posição (1..N). */
  serie: { dia: number; rotulo: number; iso: string; saldo: number; projetado: boolean }[];
  /** Resultado final do ciclo (receitas − despesas do ciclo, sem tirar caixinhas). Vale como economia quando encerrado. */
  resultado: number;
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

/** O saldo "Em conta agora", se positivo; senão 0. */
export function sobraParaInvestir(n: Pick<NumerosCiclo, "real">): number {
  return n.real.sobra > 0 ? n.real.sobra : 0;
}

/** Data do destaque: hoje, limitado ao ciclo. */
function dataDoDisponivel(n: Pick<NumerosCiclo, "hoje" | "inicio" | "fim">): string {
  return n.hoje < n.inicio ? n.inicio : n.hoje > n.fim ? n.fim : n.hoje;
}

/** Rótulo do saldo em conta: "Em conta agora" (já recebido menos já pago). Não é o destaque. */
export function textoDisponivel(_n?: Pick<NumerosCiclo, "hoje" | "inicio" | "fim">): string {
  return ROTULO_SOBRA_REAL;
}

/** DESTAQUE: "Vai sobrar em DD/MM" (o previsto para sobrar no fim do ciclo). */
export function textoVaiSobrar(n: Pick<NumerosCiclo, "fim">): string {
  return `Vai sobrar em ${diaMesNum(n.fim)}`;
}

/** Abaixo do destaque: "Pode gastar R$ Y por dia até DD/MM", ou "Faltam R$ X para fechar o ciclo" se o previsto é negativo. */
export function textoPorDia(n: Pick<NumerosCiclo, "fim" | "porDia" | "faltaParaFechar" | "previsto" | "encerrado">, formatar: (v: number) => string): string {
  if (n.previsto.sobra < 0) return `Faltam ${formatar(n.faltaParaFechar)} para fechar o ciclo`;
  if (n.encerrado) return "Ciclo encerrado";
  if (n.porDia <= 0) return "Sem folga para gastar até o fim do ciclo";
  return `Pode gastar ${formatar(n.porDia)} por dia até ${diaMesNum(n.fim)}`;
}

/**
 * Detalhe secundário: "Em conta agora: R$ X (já recebido menos já pago). Ainda vão entrar R$ A e vencer R$ B.
 * Caixinhas do ciclo R$ Y." Fecha com o destaque: em conta + a entrar − a vencer − caixinhas = vai sobrar.
 */
export function textoEmConta(n: NumerosCiclo, formatar: (v: number) => string): string {
  const p = n.previsto;
  const base = `${ROTULO_SOBRA_REAL}: ${formatar(n.real.sobra)} (já recebido menos já pago).`;
  const partes: string[] = [];
  if (p.aindaVaoEntrar >= 0.5) partes.push(`entrar ${formatar(p.aindaVaoEntrar)}`);
  if (p.aindaVaoVencer >= 0.5) partes.push(`vencer ${formatar(p.aindaVaoVencer)}`);
  const caixinhas = p.caixinhas >= 0.5 ? ` Caixinhas do ciclo ${formatar(p.caixinhas)}.` : "";
  return `${partes.length ? `${base} Ainda vão ${partes.join(" e ")}.` : base}${caixinhas}`;
}

/** Rótulo do previsto: "Previsto para sobrar em DD/MM". */
export function rotuloPrevisto(n: Pick<NumerosCiclo, "fim">): string {
  return `${ROTULO_SOBRA_PREVISTA} em ${diaMesNum(n.fim)}`;
}

/** Linha pequena sob o destaque: "Previsto para sobrar em DD/MM: R$ X". */
export function textoPrevisto(n: NumerosCiclo, formatar: (v: number) => string): string {
  return `${rotuloPrevisto(n)}: ${formatar(n.previsto.sobra)}`;
}

/** Explica a diferença entre o previsto e o que está em conta, sempre com as mesmas palavras. */
export function textoDiferenca(n: NumerosCiclo, formatar: (v: number) => string): string {
  const p = n.previsto;
  const partes: string[] = [];
  if (p.aindaVaoEntrar >= 0.5) partes.push(`${formatar(p.aindaVaoEntrar)} que ainda vão entrar`);
  if (p.aindaVaoVencer >= 0.5) partes.push(`${formatar(p.aindaVaoVencer)} de contas que ainda vão vencer`);
  if (p.caixinhas >= 0.5) partes.push(`${formatar(p.caixinhas)} guardados nas caixinhas`);
  if (partes.length === 0) return "Igual ao que está em conta: nada mais entra ou vence no ciclo.";
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0];
  return `Inclui ${lista}.`;
}

/** Economia (resultado final) de um ciclo já fechado. Não entra como receita do ciclo seguinte. */
export function economiaDoCiclo(n: Pick<NumerosCiclo, "resultado">): number {
  return r2(n.resultado);
}

/**
 * Detalhe da economia de um ciclo fechado: total X = receitas − despesas; caixinhas A; livre B = X − A
 * (igual ao último "Previsto para sobrar" quando tudo se realizou).
 */
export function detalheEconomia(n: Pick<NumerosCiclo, "resultado" | "previsto">, total?: number) {
  const x = r2(total ?? n.resultado);
  const a = r2(n.previsto.caixinhas);
  return { total: x, caixinhas: a, livre: r2(x - a) };
}

/** Soma dos ciclos fechados salvos (economia_ciclos.valor_centavos). */
export function economiaAcumulada(lista: { valor_centavos: number | string | null }[] | null | undefined): number {
  const c = (lista ?? []).reduce((s, x) => s + (Number(x.valor_centavos) || 0), 0);
  return r2(c / 100);
}

type BaseCiclo = { parcelas: any[]; recProj: any[] };

/** Lançamentos e receitas projetados numa janela que cobre todos os `meses` pedidos (calculado uma vez). */
function montarBase(dados: DadosCiclo, meses: string[], agora: Date): BaseCiclo {
  const mesHoje = competenciaAtual(agora);
  const janela = new Set<string>();
  for (let i = -12; i <= 24; i++) janela.add(somarMeses(mesHoje, i));
  for (const mes of meses) for (let i = -4; i <= 2; i++) janela.add(somarMeses(mes, i));
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

function datasEntre(ini: string, fim: string): string[] {
  const out: string[] = [];
  const [a = 1970, m = 1, d = 1] = ini.split("-").map(Number);
  for (const x = new Date(a, m - 1, d); isoDe(x) <= fim; x.setDate(x.getDate() + 1)) out.push(isoDe(x));
  return out;
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

  const jan = janelasDoCiclo(mes, diaVirada);
  // Série e posição: do dia D ao dia D do mês seguinte (receitas e despesas juntas).
  const datas = datasEntre(jan.inicio, jan.fim);
  const indice = new Map(datas.map((d, i) => [d, i + 1]));
  const dias = datas.length;
  const hojeIso = isoDe(agora);
  const encerrado = hojeIso > jan.fim;
  const futuro = hojeIso < jan.inicio;
  const diaHoje = indice.get(hojeIso) ?? (encerrado ? dias : 0);
  const posicao = (iso: string) => indice.get(iso) ?? (iso < datas[0]! ? 1 : dias);
  const naJanelaDesp = (iso: string) => iso >= jan.despesas.inicio && iso <= jan.despesas.fim;
  const noCiclo = (p: any) => despesaNoCiclo(p, jan, dados.cartoes);

  const entPrev = new Array(dias + 1).fill(0);
  const saiPrev = new Array(dias + 1).fill(0);
  const entReal = new Array(dias + 1).fill(0);
  const saiReal = new Array(dias + 1).fill(0);
  let recPrev = 0;
  let desPrev = 0;
  let recReal = 0;
  let desReal = 0;

  // Receitas: pela DATA PREVISTA na janela de receitas. Recebida: fixa quando a data prevista chega (lançada
  // ou não, como a conta fixa que vence); avulsa só quando lançada e com data real até hoje.
  // (Não existe hoje controle de "fixa não recebida/adiada" na receita; quando existir, tirar aqui.)
  for (const r of filtrarReceitasNaJanela(recProj, jan.receitas.inicio, jan.receitas.fim)) {
    const iso = r.data_prevista_ciclo;
    const realIso = String(r.data_recebimento ?? "").slice(0, 10);
    const val = vr(r);
    const i = posicao(iso);
    recPrev += val;
    entPrev[i] += val;
    const fixa = Boolean(r.recorrente || r.projetada);
    const recebida = fixa ? iso <= hojeIso || (!r.projetada && realIso <= hojeIso) : !r.projetada && realIso <= hojeIso;
    if (recebida) {
      recReal += val;
      entReal[i] += val;
    }
  }
  // Despesas: faturas que FECHAM no mês M+1 e contas que VENCEM no ciclo. Vencida = vencimento até hoje.
  // Na série, o que vence depois do fim do ciclo fica no último dia (comprometido). Crédito (estorno) e
  // pagamento de fatura (regra) ficam fora.
  for (const p of parcelas) {
    if (p.despesa?.direcao === "credito") continue;
    if (!contaComoDespesa(p.despesa, dados.somarPagamentoFatura)) continue;
    if (!noCiclo(p)) continue;
    const iso = String(p.vencimento ?? "").slice(0, 10);
    const i = posicao(iso);
    const val = v(p);
    desPrev += val;
    saiPrev[i] += val;
    if (iso <= hojeIso) {
      desReal += val;
      saiReal[i] += val;
    }
  }
  // Investimentos (regra "Somar investimentos"): resgate entra na janela de receitas, aporte sai na de despesas.
  if (dados.movimentosInvestimento?.length) {
    for (const m of dados.movimentosInvestimento) {
      const entrada = totaisInvestimentos([m], () => true).entradas > 0;
      const dentro = entrada ? m.data >= jan.receitas.inicio && m.data <= jan.receitas.fim : naJanelaDesp(m.data);
      if (!dentro) continue;
      const i = posicao(m.data);
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
    const janelaSet = (mm: string) => {
      const jj = janelasDoCiclo(mm, diaVirada);
      return (p: any) => despesaNoCiclo(p, jj, dados.cartoes);
    };
    const soma = (lista: any[], dentro: (p: any) => boolean) => lista.reduce((s, p) => (dentro(p) ? s + v(p) : s), 0);
    for (const c of dados.cartoes as any[]) {
      if (c.tipo && c.tipo !== "credito") continue;
      if (faturas.some((f: any) => f.cartao_id === c.id && f.competencia === mes && f.modo_calculo === "somente_total")) continue;
      const doCartao = parcelas.filter(
        (p) => p.despesa?.cartao_id === c.id && p.despesa?.direcao !== "credito" && contaComoDespesa(p.despesa, dados.somarPagamentoFatura),
      );
      const noPeriodo = doCartao.filter(noCiclo);
      const real = soma(doCartao, noCiclo);
      const vencs = [...new Set(noPeriodo.map((p) => String(p.vencimento).slice(0, 10)))];
      const abertas = vencs.length === 0 || vencs.some((venc) => hojeIso <= fechamentoDaFatura(venc, c.dia_fechamento));
      if (!abertas) continue;
      if (noPeriodo.length > 0 && noPeriodo.every((p) => p.paga)) continue;
      const hist: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const s = soma(doCartao, janelaSet(somarMeses(mes, -i)));
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
  const aindaVaoEntrar = recPrev - recReal;
  const aindaVaoVencer = desPrev - desReal;
  // Previsto para sobrar = Em conta agora + a entrar − a vencer − caixinhas (= receitas − despesas − caixinhas).
  const sobraPrevista = sobraReal + aindaVaoEntrar - aindaVaoVencer - meta;

  // Série: disponível até hoje; depois, o previsto (o que ainda falta entra nos dias que faltam).
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
    serie.push({ dia: d, rotulo: Number(datas[d - 1]!.slice(8, 10)), iso: datas[d - 1]!, saldo: r2(acc), projetado });
  }
  const diasRestantes = encerrado ? 0 : diaHoje === 0 ? dias : dias - diaHoje + 1;
  const diasAteFim = encerrado ? 0 : Math.max(0, diasEntre(futuro ? jan.inicio : hojeIso, jan.fim));
  const porDia = diasRestantes > 0 && sobraPrevista > 0 ? sobraPrevista / diasRestantes : 0;

  const real = { receitas: r2(recReal), despesas: r2(desReal), sobra: r2(sobraReal) };
  return {
    mes,
    inicio: jan.inicio,
    fim: jan.fim,
    rotulo: jan.rotulo,
    textoCiclo: encerrado ? jan.rotulo : textoCiclo(jan, diasAteFim),
    janelas: jan,
    diasAteFim,
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
      aindaVaoEntrar: r2(aindaVaoEntrar),
      aindaVaoVencer: r2(aindaVaoVencer),
      faturaEstimada: r2(faturaEstimada),
    },
    estimativas,
    sobraParaInvestir: sobraParaInvestir({ real }),
    porDia: r2(porDia),
    faltaParaFechar: r2(sobraPrevista < 0 ? -sobraPrevista : 0),
    serie,
    resultado: r2(recPrev - desPrev),
  };
}

/** Ritmo de gasto do ciclo (14/11/2026). Mesma base e mesmas regras da conta única. */
export type RitmoCiclo = {
  /** Gasto variável médio por dia no ciclo atual (até hoje). */
  porDiaAtual: number;
  /** Idem, ciclo anterior inteiro. 0 se não houve gasto variável. */
  porDiaAnterior: number;
  /** (atual − anterior) / anterior em %, arredondado. null sem ciclo anterior com dados. */
  variacaoPct: number | null;
  /** Previsto para sobrar menos o gasto variável novo esperado pelo ritmo. */
  projecaoNoRitmo: number;
  /** Gasto novo esperado até o fim (já sem o que está comprometido). */
  adicional: number;
  /** Dias ainda por viver no ciclo, sem contar hoje (base da projeção). */
  diasRestantes: number;
  /** Ciclo com 3 dias ou menos (ou ainda não começou): ritmo não é confiável. */
  cedo: boolean;
};

/**
 * Variável = despesa tipo "variavel", não projetada de recorrência, não crédito/estorno, não parcela 2+
 * (parcelas futuras já são compromisso, estão no previsto). Data do gasto = data_compra (senão vencimento).
 * Projeção = previsto.sobra − max(0, porDiaAtual × dias que faltam − variáveis já agendadas depois de hoje).
 */
export function ritmoDoCiclo(
  dados: DadosCiclo,
  mes: string,
  n: Pick<NumerosCiclo, "previsto" | "diaHoje" | "diasNoCiclo" | "encerrado" | "futuro" | "inicio" | "fim" | "hoje">,
  diaVirada?: number | null,
  agora: Date = new Date(),
): RitmoCiclo {
  const ant = janelasDoCiclo(somarMeses(mes, -1), diaVirada);
  const { parcelas } = montarBase(dados, [mes, somarMeses(mes, -1)], agora);
  const variaveis: { iso: string; val: number }[] = [];
  for (const p of parcelas) {
    const d = p.despesa;
    if (p.projetada || d?.direcao === "credito" || d?.tipo !== "variavel") continue;
    if (!contaComoDespesa(d, dados.somarPagamentoFatura)) continue;
    if (Number(p.numero ?? 1) > 1) continue;
    const iso = String(d.data_compra ?? p.vencimento ?? "").slice(0, 10);
    variaveis.push({ iso, val: toBRL(Number(p.valor), p.despesa.moeda, dados.cotacao) });
  }
  const soma = (ini: string, fim: string) => variaveis.reduce((s, x) => (x.iso >= ini && x.iso <= fim ? s + x.val : s), 0);
  const decorridos = n.futuro ? 0 : Math.max(1, n.encerrado ? n.diasNoCiclo : n.diaHoje);
  const ate = n.hoje < n.fim ? n.hoje : n.fim;
  const porDiaAtual = decorridos > 0 ? soma(n.inicio, ate) / decorridos : 0;
  const diasAnt = datasEntre(ant.inicio, ant.fim).length;
  const totalAnt = soma(ant.inicio, ant.fim);
  const porDiaAnterior = diasAnt > 0 ? totalAnt / diasAnt : 0;
  const variacaoPct = porDiaAnterior > 0 ? Math.round(((porDiaAtual - porDiaAnterior) / porDiaAnterior) * 100) : null;
  const diasRestantes = n.encerrado ? 0 : Math.max(0, n.diasNoCiclo - n.diaHoje);
  const agendado = soma(addDiaIso(n.hoje), n.fim);
  const adicional = Math.max(0, porDiaAtual * diasRestantes - agendado);
  return {
    porDiaAtual: r2(porDiaAtual),
    porDiaAnterior: r2(porDiaAnterior),
    variacaoPct,
    projecaoNoRitmo: r2(n.previsto.sobra - adicional),
    adicional: r2(adicional),
    diasRestantes,
    cedo: n.futuro || decorridos <= 3,
  };
}

function addDiaIso(iso: string): string {
  const [a = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return isoDe(new Date(a, m - 1, d + 1));
}

/** Frase do ritmo (abaixo do gráfico). tom: "neutro" | "negativo" | "positivo". */
export function textoRitmo(
  r: RitmoCiclo,
  fim: string,
  formatar: (v: number) => string,
): { linha1: string; linha2: string | null; tom: "neutro" | "negativo" | "positivo" } {
  if (r.cedo) return { linha1: "Ainda é cedo para medir o ritmo deste ciclo.", linha2: null, tom: "neutro" };
  let linha1 = `Em média, neste ciclo você está gastando ${formatar(r.porDiaAtual)} por dia`;
  if (r.variacaoPct !== null && r.variacaoPct !== 0) {
    linha1 += `, ${Math.abs(r.variacaoPct)}% ${r.variacaoPct < 0 ? "menor" : "maior"} que no ciclo anterior`;
  } else if (r.variacaoPct === 0) linha1 += ", igual ao ciclo anterior";
  linha1 += ".";
  if (r.projecaoNoRitmo < 0) {
    return {
      linha1,
      linha2: `Nesse ritmo, o ciclo fecha negativo em ${formatar(-r.projecaoNoRitmo)}, a não ser que comece a poupar agora.`,
      tom: "negativo",
    };
  }
  return { linha1, linha2: `Nesse ritmo, sobram ${formatar(r.projecaoNoRitmo)} em ${diaMesNum(fim)}.`, tom: "positivo" };
}
