import { monthKey } from "@/lib/format";

export type Periodicidade = "mensal" | "semestral" | "anual";

export const PERIODICIDADES: { value: Periodicidade; label: string; meses: number }[] = [
  { value: "mensal", label: "Mensal", meses: 1 },
  { value: "semestral", label: "Semestral", meses: 6 },
  { value: "anual", label: "Anual", meses: 12 },
];

export function mesesDaPeriodicidade(p: Periodicidade): number {
  return p === "mensal" ? 1 : p === "semestral" ? 6 : 12;
}

export interface ReajusteConfig {
  percentual: number;
  periodicidade: Periodicidade;
  /** Competência (ou data) do primeiro reajuste. Sem valor, usa o mês seguinte ao início. */
  inicio?: string | null;
  indice?: string | null;
}

export interface RecorrenciaFixa {
  /** Valor mensal inicial, na competência de início. */
  valor: number;
  /** Data (ou competência) em que a recorrência começa. */
  inicio: string;
  semPrazo: boolean;
  /** Quantidade de competências quando há prazo determinado. */
  meses?: number | null;
  reajuste?: ReajusteConfig | null;
}

/** Normaliza uma data ISO ou competência "AAAA-MM" para a chave de competência. */
export function competenciaDe(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) return value;
  return monthKey(value);
}

/** Diferença em meses entre duas competências (b - a). */
export function mesesEntreCompetencias(a: string, b: string): number {
  const [ay, am] = competenciaDe(a).split("-").map(Number);
  const [by, bm] = competenciaDe(b).split("-").map(Number);
  return (by! - ay!) * 12 + (bm! - am!);
}

export function somarMeses(competencia: string, n: number): string {
  const [y, m] = competenciaDe(competencia).split("-").map(Number);
  const total = y! * 12 + (m! - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = total % 12;
  return `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

/** Arredonda para centavos evitando erro de ponto flutuante. */
function paraCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

/** Quantas vezes o reajuste já foi aplicado até a competência informada. */
export function aplicacoesDeReajuste(r: RecorrenciaFixa, competencia: string): number {
  const cfg = r.reajuste;
  if (!cfg || !Number.isFinite(cfg.percentual) || cfg.percentual === 0) return 0;
  const inicioReajuste = cfg.inicio
    ? competenciaDe(cfg.inicio)
    : somarMeses(competenciaDe(r.inicio), mesesDaPeriodicidade(cfg.periodicidade));
  const diff = mesesEntreCompetencias(inicioReajuste, competenciaDe(competencia));
  if (diff < 0) return 0;
  return Math.floor(diff / mesesDaPeriodicidade(cfg.periodicidade)) + 1;
}

/** Índice da competência dentro da recorrência (0 = primeira); -1 quando fora. */
export function ordemDaCompetencia(r: RecorrenciaFixa, competencia: string): number {
  const diff = mesesEntreCompetencias(r.inicio, competencia);
  if (diff < 0) return -1;
  if (!r.semPrazo && r.meses && diff >= r.meses) return -1;
  return diff;
}

export function ativaNaCompetencia(r: RecorrenciaFixa, competencia: string): boolean {
  return ordemDaCompetencia(r, competencia) >= 0;
}

/**
 * Valor vigente da recorrência na competência informada, com reajuste composto
 * sempre aplicado sobre o último valor reajustado. Retorna null fora do período.
 */
export function valorNaCompetencia(r: RecorrenciaFixa, competencia: string): number | null {
  if (!ativaNaCompetencia(r, competencia)) return null;
  let cents = paraCentavos(r.valor);
  const n = aplicacoesDeReajuste(r, competencia);
  const fator = 1 + (r.reajuste?.percentual ?? 0) / 100;
  for (let i = 0; i < n; i++) cents = Math.round(cents * fator);
  return cents / 100;
}

export interface CompetenciaProjetada {
  competencia: string;
  valor: number;
  ordem: number;
  /** Total de competências quando há prazo determinado. */
  total: number | null;
}

/** Projeta as competências da recorrência dentro de um intervalo (inclusive). */
export function projetarCompetencias(
  r: RecorrenciaFixa,
  de: string,
  ate: string,
): CompetenciaProjetada[] {
  const inicio = competenciaDe(r.inicio);
  const primeira = mesesEntreCompetencias(de, inicio) > 0 ? inicio : competenciaDe(de);
  const ultimaPorPrazo = !r.semPrazo && r.meses ? somarMeses(inicio, r.meses - 1) : null;
  const limite =
    ultimaPorPrazo && mesesEntreCompetencias(ultimaPorPrazo, competenciaDe(ate)) > 0
      ? ultimaPorPrazo
      : competenciaDe(ate);
  const qtd = mesesEntreCompetencias(primeira, limite);
  const out: CompetenciaProjetada[] = [];
  for (let i = 0; i <= qtd; i++) {
    const competencia = somarMeses(primeira, i);
    const valor = valorNaCompetencia(r, competencia);
    if (valor == null) continue;
    out.push({
      competencia,
      valor,
      ordem: ordemDaCompetencia(r, competencia),
      total: r.semPrazo ? null : (r.meses ?? null),
    });
  }
  return out;
}

/** Lê a recorrência a partir de uma linha de `despesas`. */
export function recorrenciaDaDespesa(d: any): RecorrenciaFixa | null {
  if ((d?.tipo ?? "") !== "fixa") return null;
  const valor = Number(d.valor_total) || 0;
  const inicio = d.recorrencia_inicio ?? d.data_primeira_parcela ?? d.data_compra;
  if (!inicio) return null;
  const semPrazo = d.recorrencia_sem_prazo !== false && !d.recorrencia_meses;
  const percentual = Number(d.reajuste_percentual);
  return {
    valor,
    inicio,
    semPrazo,
    meses: d.recorrencia_meses ?? null,
    reajuste:
      Number.isFinite(percentual) && percentual !== 0 && d.reajuste_periodicidade
        ? {
            percentual,
            periodicidade: d.reajuste_periodicidade as Periodicidade,
            inicio: d.reajuste_inicio ?? null,
            indice: d.reajuste_indice ?? null,
          }
        : null,
  };
}
