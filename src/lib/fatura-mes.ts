import { monthKey } from "@/lib/format";

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
    const regra = mapa.get(`${cartaoId}:${monthKey(p.vencimento)}`);
    if (!regra) return true;
    // Aberta: só o resumo manual entra no total. Concluída: só os itens importados entram.
    return regra.status === "aberta"
      ? p.despesa_id === regra.despesa_avulsa_id
      : p.despesa_id !== regra.despesa_avulsa_id;
  });
}
