/**
 * Funções puras da calculadora de datas e horários do módulo Control ALL
 * (`/ferramentas`). Utilitários de uso geral, sem nenhuma relação com dados
 * financeiros — por isso moram num arquivo próprio, sem depender de nada do
 * resto do app além de `@/lib/format`.
 */
import { addMonths, toISODate } from "@/lib/format";

export type UnidadeTempo = "segundos" | "minutos" | "horas" | "dias" | "anos" | "seculos";
export type UnidadeIntervalo = "dias" | "meses" | "anos" | "seculos";

// Ano trópico médio do calendário gregoriano (365 dias + 1/4 - 1/100 +
// 1/400) — usado só pra converter dias em anos/séculos na diferença entre
// datas. Mais preciso que "365" fixo (evita acumular erro em intervalos
// longos) sem precisar de calendário civil (mês/ano do calendário) pra uma
// unidade que já é aproximada por natureza.
const DIAS_POR_ANO = 365.2425;

// Meio-dia fixo evita problemas de fuso horário/horário de verão ao
// converter uma data "solta" (yyyy-mm-dd) em `Date` — mesmo padrão já usado
// em outras partes do app (ver `new Date(\`${data}T12:00:00\`)`).
function paraData(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Diferença entre duas datas (yyyy-mm-dd), na unidade escolhida. Sempre
 * devolve um número não negativo — quem chama decide como mostrar qual data
 * é anterior à outra. Dias/horas/minutos/segundos vêm arredondados pro
 * inteiro mais próximo; anos/séculos vêm com até 2 casas decimais (unidade
 * grande demais pra fazer sentido só em número inteiro).
 */
export function diferencaEntreDatas(
  dataInicio: string,
  dataFim: string,
  unidade: UnidadeTempo,
): number {
  const ms = Math.abs(paraData(dataFim).getTime() - paraData(dataInicio).getTime());
  const dias = ms / 86_400_000;
  switch (unidade) {
    case "dias":
      return Math.round(dias);
    case "horas":
      return Math.round(dias * 24);
    case "minutos":
      return Math.round(dias * 24 * 60);
    case "segundos":
      return Math.round(dias * 24 * 60 * 60);
    case "anos":
      return arredondar2(dias / DIAS_POR_ANO);
    case "seculos":
      return arredondar2(dias / DIAS_POR_ANO / 100);
  }
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
  const meses =
    unidade === "seculos" ? quantidade * 1200 : unidade === "anos" ? quantidade * 12 : quantidade;
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
