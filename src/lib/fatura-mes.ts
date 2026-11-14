import { monthKey, competenciaDoDia } from "@/lib/format";

export type RegraFaturaMes = {
  cartao_id: string;
  competencia: string;
  modo_calculo?: string | null;
  status?: string | null;
  despesa_avulsa_id?: string | null;
};

/** Aplica o modo "somente o total" apenas ao cartão e competência escolhidos. */
export function aplicarRegrasFaturaMes<
  T extends { despesa_id: string; vencimento: string; despesa?: any },
>(lancamentos: T[], regras: RegraFaturaMes[]): T[] {
  const mapa = new Map(
    regras
      .filter((r) => r.modo_calculo === "somente_total")
      .map((r) => [`${r.cartao_id}:${r.competencia}`, r]),
  );
  return lancamentos.filter((p) => {
    const cartaoId = p.despesa?.cartao_id;
    if (!cartaoId) return true;
    const regra = mapa.get(`${cartaoId}:${competenciaDoDia(p.vencimento)}`);
    if (!regra) return true;
    // Aberta: só o resumo manual entra no total. Concluída: só os itens importados entram.
    return regra.status === "aberta"
      ? p.despesa_id === regra.despesa_avulsa_id
      : p.despesa_id !== regra.despesa_avulsa_id;
  });
}

export type ModoFaturaMes = "inclui_parcelas" | "somar_parcelas" | "somente_total";

/**
 * Cálculo do diálogo "Fatura do mês".
 * - inclui_parcelas: o informado é o total real; lança só a diferença (pode ser negativa) sobre o que já existe.
 * - somar_parcelas: o informado soma por cima (despesa fixa sem categoria).
 * - somente_total: substitui tudo do cartão no mês pelo informado.
 */
export function calcularFaturaMes(modo: ModoFaturaMes, totalInformado: number, previstas: number) {
  const avulso = modo === "inclui_parcelas" ? totalInformado - previstas : totalInformado;
  const totalMes = modo === "somar_parcelas" ? totalInformado + previstas : totalInformado;
  return { avulso: Math.round(avulso * 100) / 100, totalMes: Math.round(totalMes * 100) / 100 };
}

/** Data de fechamento (AAAA-MM-DD) da fatura que entra na competência (a fatura entra pelo mês de fechamento). */
export function fechamentoDaCompetencia(competencia: string, diaFechamento?: number | null): string {
  const [y, m] = competencia.split("-").map(Number);
  const ultimo = new Date(y!, m!, 0).getDate();
  const d = Math.min(diaFechamento && diaFechamento > 0 ? diaFechamento : ultimo, ultimo);
  return `${competencia}-${String(d).padStart(2, "0")}`;
}
