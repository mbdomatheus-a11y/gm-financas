import { calcularNumerosCiclo, datasDoCiclo, type EstimativaFatura, type NumerosCiclo } from "@/lib/numeros-ciclo";

/**
 * Previsão do mês (07/11/2026): adaptador fino sobre calcularNumerosCiclo (src/lib/numeros-ciclo.ts), a ÚNICA
 * fonte de "sobra" do site e do app. Aqui não há conta própria. O forecast por ritmo de gasto foi removido.
 *  saldoLivre / sobraPrevista = PREVISTO NO FIM DO CICLO (receitas previstas − despesas previstas − caixinhas).
 *  numeros.real.sobra = REAL ATÉ HOJE ("Sobra até agora").
 */
export { datasDoCiclo };
export type { EstimativaFatura };

export type PrevisaoMes = {
  diasNoMes: number;
  diaHoje: number;
  /** Receitas previstas do ciclo (lançadas + fixas projetadas). */
  receitas: number;
  /** Despesas previstas do ciclo (lançadas + recorrentes + fatura estimada). */
  comprometido: number;
  /** Caixinhas: valor a guardar no ciclo. */
  meta: number;
  /** = previsto no fim do ciclo (depois das caixinhas). */
  saldoLivre: number;
  diasRestantes: number;
  porDia: number;
  /** Receitas − despesas previstas, antes das caixinhas. */
  finalPrevisto: number;
  /** = previsto no fim do ciclo. */
  sobraPrevista: number;
  alerta: boolean;
  estimativas: EstimativaFatura[];
  estimadoTotal: number;
  serie: NumerosCiclo["serie"];
  /** Os dois blocos (real e previsto). Toda tela deve ler a sobra daqui. */
  numeros: NumerosCiclo;
};

export function calcularPrevisaoMes(
  dados: Parameters<typeof calcularNumerosCiclo>[0],
  mes: string,
  metaPoupar = 0,
  diaVirada?: number | null,
  // Mantido por compatibilidade: a regra "a partir do dia N" já vem aplicada na competência das receitas.
  _receitasProximoCicloDia?: number | null,
): PrevisaoMes {
  const n = calcularNumerosCiclo(dados, mes, metaPoupar, diaVirada);
  return {
    diasNoMes: n.diasNoCiclo,
    diaHoje: n.diaHoje,
    receitas: n.previsto.receitas,
    comprometido: n.previsto.despesas,
    meta: n.previsto.caixinhas,
    saldoLivre: n.previsto.sobra,
    diasRestantes: n.diasRestantes,
    porDia: n.porDia,
    finalPrevisto: Math.round((n.previsto.sobra + n.previsto.caixinhas) * 100) / 100,
    sobraPrevista: n.previsto.sobra,
    alerta: n.previsto.sobra < 0,
    estimativas: n.estimativas,
    estimadoTotal: n.previsto.faturaEstimada,
    serie: n.serie,
    numeros: n,
  };
}
