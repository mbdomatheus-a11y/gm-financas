// Simulador de rendimento da sobra (17/11/2026). Mesmo arquivo no site e no app.
// Regras: juros compostos mensais pela taxa equivalente, sem IOF. Poupança isenta de IR; CDB com IR regressivo
// (12 meses 17,5%, 24 e 36 meses 15%). Poupança: Selic meta > 8,5% a.a. rende 0,5% ao mês + TR; senão 70% da Selic.

export const PRAZOS_MESES = [12, 24, 36] as const;
export type PrazoMeses = (typeof PRAZOS_MESES)[number];
export type IdCenario = 'poupanca' | 'cdi100' | 'cdi110' | 'cdi120';

export const CENARIOS: { id: IdCenario; rotulo: string; percCdi?: number }[] = [
  { id: 'poupanca', rotulo: 'Poupança' },
  { id: 'cdi100', rotulo: '100% do CDI', percCdi: 100 },
  { id: 'cdi110', rotulo: '110% do CDI', percCdi: 110 },
  { id: 'cdi120', rotulo: '120% do CDI', percCdi: 120 },
];

export const LIMITE_SELIC_POUPANCA = 8.5;

export function aliquotaIR(meses: number): number {
  return meses <= 12 ? 0.175 : 0.15;
}

/** Taxa mensal (em fração) equivalente a uma taxa anual em %. */
export function mensalDeAnual(anualPct: number): number {
  return Math.pow(1 + anualPct / 100, 1 / 12) - 1;
}

/** Taxa mensal (fração) da poupança. trMensalPct: TR do mês em %, 0 se indisponível. */
export function taxaMensalPoupanca(selicAnualPct: number, trMensalPct = 0): number {
  if (selicAnualPct > LIMITE_SELIC_POUPANCA) return (1 + 0.005) * (1 + Math.max(0, trMensalPct) / 100) - 1;
  return mensalDeAnual(selicAnualPct * 0.7);
}

export type ResultadoPrazo = { final: number; ganho: number };
export type LinhaSimulacao = { id: IdCenario; rotulo: string; prazos: Record<PrazoMeses, ResultadoPrazo> };
export type Simulacao = { linhas: LinhaSimulacao[]; melhor: Record<PrazoMeses, IdCenario> };

const arred = (n: number) => Math.round(n * 100) / 100;

export function simularRendimento(valor: number, cdiAnualPct: number, selicAnualPct: number, trMensalPct = 0): Simulacao {
  const v = Number.isFinite(valor) && valor > 0 ? valor : 0;
  const linhas: LinhaSimulacao[] = CENARIOS.map((c) => {
    const prazos = {} as Record<PrazoMeses, ResultadoPrazo>;
    for (const m of PRAZOS_MESES) {
      let ganho: number;
      if (c.id === 'poupanca') {
        ganho = v * (Math.pow(1 + taxaMensalPoupanca(selicAnualPct, trMensalPct), m) - 1);
      } else {
        const bruto = v * (Math.pow(1 + mensalDeAnual(cdiAnualPct * (c.percCdi! / 100)), m) - 1);
        ganho = bruto * (1 - aliquotaIR(m));
      }
      prazos[m] = { final: arred(v + ganho), ganho: arred(ganho) };
    }
    return { id: c.id, rotulo: c.rotulo, prazos };
  });
  const melhor = {} as Record<PrazoMeses, IdCenario>;
  for (const m of PRAZOS_MESES) melhor[m] = linhas.reduce((a, b) => (b.prazos[m].final > a.prazos[m].final ? b : a)).id;
  return { linhas, melhor };
}

/** Aceita "4000", "4.000,50", "4000,5". */
export function lerValorDigitado(t: string): number {
  const n = Number(t.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function textoPct(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
}
