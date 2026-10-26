/**
 * Fatura do cartão: em qual fatura (pela data de vencimento) cai uma compra.
 *  - Fechamento: dia de fechamento do cadastro. Se vazio, vencimento menos 7 dias.
 *  - Compra até o dia do fechamento (inclusive) entra na fatura que fecha naquele dia.
 *    A partir do dia seguinte, entra na fatura do fechamento seguinte.
 *  - A fatura vence no dia de vencimento. Se o vencimento for antes do fechamento
 *    (ex.: fecha dia 25, vence dia 5), vence no mês seguinte ao fechamento.
 *  - Dias que não existem no mês (dia 31 em fevereiro) usam o último dia do mês.
 * Datas em AAAA-MM-DD.
 */
export type CicloCartao = { diaFechamento: number | null; diaVencimento: number; diasAntes?: number };

/**
 * Padrão de fechamento por banco quando o cadastro não tem o dia (25/10/2026):
 * Nubank e C6 fecham 7 dias corridos antes do vencimento; Itaú, 10 (as parcelas vêm datadas no
 * fechamento, ex.: dia 5 para vencimento 15); demais bancos, 8. O usuário pode trocar por cartão; no cadastro com o dia informado, vale o dia informado.
 */
export function diasAntesPadrao(nomeBanco: string | null | undefined): number {
  const n = String(nomeBanco ?? "");
  // Conferido com as faturas reais (25/10/2026): Nubank e Santander com vencimento 15 fecham no dia 6
  // (a compra do dia 7 já vai para a fatura seguinte); Itaú, 10 dias antes (dia 5 para vencimento 15).
  if (/nubank|nu pagamentos|\bc6\b|croma|santander/i.test(n)) return 9;
  return 8; // Itaú confere nas faturas: fecha 7 a 8 dias antes (dia 8 p/ venc. 15, dia 10 p/ venc. 17)
}

/** Dia de fechamento sugerido (1 a 31) a partir do vencimento e do banco. */
export function fechamentoPadrao(diaVencimento: number, nomeBanco?: string | null): number {
  const d = new Date(Date.UTC(2026, 0, diaVencimento - diasAntesPadrao(nomeBanco)));
  return d.getUTCDate();
}

const DIA_MS = 86400000;

function diaDoMes(ano: number, mes: number, dia: number): number {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return Date.UTC(ano, mes - 1, Math.min(Math.max(dia, 1), ultimo));
}

function paraIso(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function vencimentoDaFatura(dataCompra: string, ciclo: CicloCartao): string {
  const [ano, mes, dia] = dataCompra.slice(0, 10).split("-").map(Number) as [number, number, number];
  const compra = Date.UTC(ano, mes - 1, dia);

  const candidatas: { fechamento: number; vencimento: number }[] = [];
  for (let k = -1; k <= 1; k++) {
    const ref = new Date(Date.UTC(ano, mes - 1 + k, 1));
    const a = ref.getUTCFullYear();
    const m = ref.getUTCMonth() + 1;
    const vencimentoNoMes = diaDoMes(a, m, ciclo.diaVencimento);
    const fechamento =
      ciclo.diaFechamento != null ? diaDoMes(a, m, ciclo.diaFechamento) : vencimentoNoMes - (ciclo.diasAntes ?? 7) * DIA_MS;
    // Vencimento depois do fechamento: mesmo mês do fechamento. Antes: mês seguinte.
    const vencimento =
      ciclo.diaFechamento != null && ciclo.diaVencimento <= ciclo.diaFechamento
        ? diaDoMes(a, m + 1, ciclo.diaVencimento)
        : vencimentoNoMes;
    candidatas.push({ fechamento, vencimento });
  }
  const escolhida = candidatas
    .filter((c) => c.fechamento >= compra)
    .sort((x, y) => x.fechamento - y.fechamento)[0];
  if (!escolhida) throw new Error("Não foi possível calcular a fatura desta compra.");
  return paraIso(escolhida.vencimento);
}
