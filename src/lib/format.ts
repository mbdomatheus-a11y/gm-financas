export type Moeda = "BRL" | "USD";

// Ocultar valores (olho): dentro da área logada, todas as cifras viram máscara.
// O AppLayout liga/desliga esta chave; páginas públicas (calculadoras) não são afetadas.
let ocultarNaArea = false;
export function definirOcultarValoresNaArea(v: boolean) {
  ocultarNaArea = v;
}
export function valoresOcultosNaArea(): boolean {
  return ocultarNaArea;
}

export function formatBRLSemMascara(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatBRL(value: number): string {
  if (ocultarNaArea) return "R$ ••••••";
  return formatBRLSemMascara(value);
}

export function formatUSD(value: number): string {
  if (ocultarNaArea) return "US$ ••••••";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatMoeda(value: number, moeda: Moeda): string {
  return moeda === "USD" ? formatUSD(value) : formatBRL(value);
}

/** Converte um valor lançado em qualquer moeda para o total consolidado em reais. */
export function toBRL(value: number, moeda: string, cotacao: number): number {
  return moeda === "USD" ? value * cotacao : value;
}

export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T12:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Mês do sistema (ciclo): com dia de virada D, a competência "AAAA-MM" vai de D/MM até D-1 do mês
// seguinte e é rotulada pelo mês em que começa. Sem virada, é o mês do calendário.
// Uma preferência global (definida pelas preferências do usuário) faz todas as telas usarem a mesma regra.
let diaViradaCiclo: number | null = null;
let diaReceitaProximoCiclo: number | null = null;

const pad2 = (n: number) => String(n).padStart(2, "0");

function viradaValida(d: number | null | undefined): number | null {
  return d && d >= 2 && d <= 28 ? d : null;
}

let diaViradaUsuario: number | null = null;
let diaReceitaUsuario: number | null = null;
/** Regra do ciclo do GRUPO (08/11/2026, tabela regra_ciclo_grupo). Quando existe, vale no lugar da preferência. */
let diaViradaGrupo: number | null = null;

function aplicarCicloEfetivo() {
  diaViradaCiclo = diaViradaGrupo ?? diaViradaUsuario;
  // A regra do grupo substitui "receitas a partir do dia N": receitas contam pela data prevista.
  diaReceitaProximoCiclo = diaViradaGrupo ? null : diaReceitaUsuario;
}

export function definirCicloDoUsuario(diaVirada: number | null | undefined, receitasProximoCicloDia?: number | null) {
  diaViradaUsuario = viradaValida(diaVirada);
  diaReceitaUsuario = receitasProximoCicloDia && receitasProximoCicloDia >= 1 && receitasProximoCicloDia <= 31
    ? receitasProximoCicloDia
    : null;
  aplicarCicloEfetivo();
}

/** Dia de virada da regra do grupo (1 a 28) ou null quando o grupo ainda não configurou. */
export function definirViradaDoGrupo(dia: number | null | undefined) {
  diaViradaGrupo = dia && dia >= 1 && dia <= 28 ? dia : null;
  aplicarCicloEfetivo();
}

export function viradaDoGrupo(): number | null {
  return diaViradaGrupo;
}

export function diaViradaDefinida(): number | null {
  return viradaValida(diaViradaCiclo);
}

/** Competência (AAAA-MM) do ciclo em que a data cai. Aceita "AAAA-MM-DD", Date ou "AAAA-MM" (devolve igual). */
export function competenciaDoDia(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) return value;
  let y: number;
  let m: number;
  let dia: number;
  if (typeof value === "string") {
    const [a, b, c] = value.slice(0, 10).split("-").map(Number);
    if (!a || !b || !c) return monthKey(value);
    y = a;
    m = b;
    dia = c;
  } else {
    y = value.getFullYear();
    m = value.getMonth() + 1;
    dia = value.getDate();
  }
  const v = viradaValida(diaViradaCiclo);
  // 13/11/2026 (regra do ciclo): o ciclo vai de D+1 a D; o próprio dia D ainda é do ciclo que termina.
  if (!v || dia > v) return `${y}-${pad2(m)}`;
  const anterior = new Date(y, m - 2, 1);
  return `${anterior.getFullYear()}-${pad2(anterior.getMonth() + 1)}`;
}

/** Competência da receita: igual à do ciclo, salvo a opção "recebida a partir do dia N" (vai para o próximo ciclo). */
export function competenciaDaReceita(value: Date | string): string {
  const base = competenciaDoDia(value);
  const n = diaReceitaProximoCiclo;
  if (!n || (typeof value === "string" && /^\d{4}-\d{2}$/.test(value))) return base;
  const dia = typeof value === "string" ? Number(value.slice(8, 10)) : value.getDate();
  const d = viradaValida(diaViradaCiclo) ?? 1;
  const naFaixa = n >= d ? dia >= n || dia < d : dia >= n && dia < d;
  if (!naFaixa) return base;
  const [a, m] = base.split("-").map(Number);
  return monthKey(new Date(a!, m!, 1));
}

/** Competência do mês do sistema que contém a data de referência (padrão: hoje). */
export function competenciaAtual(ref: Date = new Date()): string {
  return competenciaDoDia(ref);
}

export function currentMonthKey(): string {
  return competenciaAtual();
}

/** Competência deslocada N meses a partir da atual (N negativo volta no tempo). */
export function mesDoCiclo(offset: number): string {
  const [y, m] = currentMonthKey().split("-").map(Number);
  return monthKey(new Date(y!, m! - 1 + offset, 1));
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function lastMonths(count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(mesDoCiclo(-i));
  }
  return out;
}

export function parseDate(value: string): Date {
  if (!value) return new Date();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
    const [d, m, y] = value.split("/");
    return new Date(`${y}-${m}-${d}T12:00:00`);
  }
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function formatDate(value: string): string {
  return parseDate(value).toLocaleDateString("pt-BR");
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** Divide o total em N parcelas, ajustando os centavos na última. */
export function dividirParcelas(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const values = Array.from({ length: n }, () => base);
  const resto = cents - base * n;
  values[n - 1] = (values[n - 1] ?? 0) + resto;
  return values.map((c) => c / 100);
}

/** Nome completo do mês com ano, ex.: "Agosto de 2026". */
export function monthLabelLong(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * "Guilherme · Itaú •1234" — identificação de responsável e forma de pagamento.
 * `nomesContas` (opcional, id -> nome): mostra a conta quando a despesa tem conta_id (07/11/2026).
 */
import { nomeBanco } from "@/lib/bancos-catalogo";

export function identificacaoDespesa(
  d: {
    responsavel?: string | null;
    banco_nome?: string | null;
    cartao_final?: string | null;
    conta_id?: string | null;
    cartoes?: { apelido?: string | null; titular?: string | null; final?: string | null } | null;
    bancos?: { nome?: string | null } | null;
  },
  nomesContas?: Map<string, string>,
): string {
  const partes: string[] = [];
  if (d.responsavel) partes.push(d.responsavel);
  const cartao = d.cartoes;
  if (cartao) {
    const nome = cartao.apelido || "Cartão";
    const titular = cartao.titular?.trim().split(/\s+/)[0];
    partes.push(
      `${cartao.final ? `${nome} •${cartao.final}` : nome}${titular ? ` · ${titular}` : ""}`,
    );
  } else if (d.conta_id && nomesContas?.get(String(d.conta_id))) {
    partes.push(nomesContas.get(String(d.conta_id))!);
  } else if (d.bancos?.nome) {
    partes.push(nomeBanco(d.bancos.nome));
  } else if (d.banco_nome) {
    {
    const bn = nomeBanco(d.banco_nome);
    partes.push(d.cartao_final ? `${bn} •${d.cartao_final}` : bn);
    }
  }
  return partes.join(" · ");
}

/** Item 10 (2026-10-05): valor abreviado para rótulos de gráfico (21837 vira 21,8K). */
export function abreviarValor(v: unknown): string {
  const n = Number(v);
  if (!n) return "";
  if (ocultarNaArea) return "••••";
  const a = Math.abs(n);
  const f = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (a >= 1_000_000) return `${f(n / 1_000_000)}M`;
  if (a >= 1_000) return formatoValoresAtual === "mil" ? `${f(n / 1_000)} mil` : `${f(n / 1_000)}K`;
  return f(n);
}

// 14/11/2026: unidade de exibição dos valores (preferencias_usuario.formato_valores).
// Vale só para cards de resumo e gráficos; listas, formulários e faturas seguem em formato completo.
export type FormatoValores = "completo" | "mil" | "k";
export const FORMATOS_VALORES: FormatoValores[] = ["completo", "mil", "k"];
const CHAVE_FORMATO_VALORES = "financas_formato_valores";
function lerFormatoSalvo(): FormatoValores {
  try {
    const v = typeof window !== "undefined" ? localStorage.getItem(CHAVE_FORMATO_VALORES) : null;
    return v === "mil" || v === "k" ? v : "completo";
  } catch {
    return "completo";
  }
}
let formatoValoresAtual: FormatoValores = lerFormatoSalvo();
const ouvintesFormato = new Set<() => void>();
export function definirFormatoValores(f: FormatoValores | null | undefined) {
  const novo: FormatoValores = f === "mil" || f === "k" ? f : "completo";
  if (novo === formatoValoresAtual) return;
  formatoValoresAtual = novo;
  try {
    localStorage.setItem(CHAVE_FORMATO_VALORES, novo);
  } catch {}
  ouvintesFormato.forEach((fn) => fn());
}
export function formatoValoresDoUsuario(): FormatoValores {
  return formatoValoresAtual;
}
export function assinarFormatoValores(fn: () => void): () => void {
  ouvintesFormato.add(fn);
  return () => {
    ouvintesFormato.delete(fn);
  };
}

/** "Completo": R$ 12.345,67 · "Mil": R$ 12,3 mil · "K": R$ 12,3k. Abaixo de mil, sempre completo. */
export function formatarValor(v: number, formato: FormatoValores = "completo"): string {
  if (ocultarNaArea) return "R$ ••••••";
  const n = Number.isFinite(v) ? v : 0;
  if (formato === "completo" || Math.abs(n) < 1000) return formatBRLSemMascara(n);
  const x = Math.abs(n) / 1000;
  const s = x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${n < 0 ? "-" : ""}R$ ${s}${formato === "mil" ? " mil" : "k"}`;
}

/** Como formatBRL, mas na unidade escolhida pelo usuário (usar só em resumos e gráficos). */
export function formatarResumoValor(v: number): string {
  if (ocultarNaArea) return "R$ ••••••";
  return formatarValor(v, formatoValoresAtual);
}
