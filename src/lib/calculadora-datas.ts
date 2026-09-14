/**
 * Funções puras da calculadora de datas e horários do módulo Control ALL
 * (`/ferramentas`). Utilitários de uso geral, sem nenhuma relação com dados
 * financeiros — por isso moram num arquivo próprio, sem depender de nada do
 * resto do app além de `@/lib/format`.
 */
import { addMonths, toISODate } from "@/lib/format";

export type UnidadeTempo = "dias" | "horas" | "minutos";
export type UnidadeIntervalo = "dias" | "meses" | "anos";

// Meio-dia fixo evita problemas de fuso horário/horário de verão ao
// converter uma data "solta" (yyyy-mm-dd) em `Date` — mesmo padrão já usado
// em outras partes do app (ver `new Date(\`${data}T12:00:00\`)`).
function paraData(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/**
 * Diferença entre duas datas (yyyy-mm-dd), na unidade escolhida. Sempre
 * devolve um número não negativo — quem chama decide como mostrar qual data
 * é anterior à outra.
 */
export function diferencaEntreDatas(
  dataInicio: string,
  dataFim: string,
  unidade: UnidadeTempo,
): number {
  const ms = Math.abs(paraData(dataFim).getTime() - paraData(dataInicio).getTime());
  const dias = ms / 86_400_000;
  if (unidade === "dias") return Math.round(dias);
  if (unidade === "horas") return Math.round(dias * 24);
  return Math.round(dias * 24 * 60);
}

/** Soma (ou subtrai, com `quantidade` negativa) um intervalo a uma data. */
export function somarIntervaloData(
  dataBase: string,
  quantidade: number,
  unidade: UnidadeIntervalo,
): string {
  if (unidade === "dias") {
    const d = paraData(dataBase);
    d.setDate(d.getDate() + quantidade);
    return toISODate(d);
  }
  const meses = unidade === "anos" ? quantidade * 12 : quantidade;
  return toISODate(addMonths(paraData(dataBase), meses));
}

export type TermoHorario = { sinal: 1 | -1; horas: number; minutos: number };

/** Resultado da soma de horários, já separado em horas/minutos e com o sinal do total. */
export type ResultadoHorario = { negativo: boolean; horas: number; minutos: number };

/**
 * Soma uma lista de durações HH:MM, cada uma com seu próprio sinal (ex.:
 * 08:00 + 7:20 - 1:15). Aceita minutos fora do intervalo 0-59 na entrada
 * (normaliza antes de somar).
 */
export function somarHorarios(termos: TermoHorario[]): ResultadoHorario {
  const totalMinutos = termos.reduce((s, t) => s + t.sinal * (t.horas * 60 + t.minutos), 0);
  const negativo = totalMinutos < 0;
  const abs = Math.abs(totalMinutos);
  return { negativo, horas: Math.floor(abs / 60), minutos: abs % 60 };
}
