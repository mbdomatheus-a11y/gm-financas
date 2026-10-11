/**
 * Substituição de fatura fechada (2026-10-11).
 *
 * Quando a fatura importada é a versão fechada do mês de um cartão que já tem
 * lançamentos, a fatura anterior sai do banco e a nova entra no lugar. Este
 * módulo guarda as regras puras dessa troca: quais compras da fatura anterior
 * a fatura nova não representa.
 */
import { encontrarCandidatas, type DespesaExistente, type LancamentoImportado } from "@/lib/duplicidade-importacao";

export type DecisaoFatura = "fechada" | "parcial";
/** O que fazer com compras da fatura anterior que a nova não traz. */
export type DecisaoFaltantes = "nova" | "mesclar" | "ambas";

/**
 * Compras da fatura anterior que nenhuma linha da fatura nova representa.
 * Usa a mesma comparação da importação (estabelecimento, valor, data próxima).
 */
export function despesasFaltantes(
  antigas: DespesaExistente[],
  novas: LancamentoImportado[],
): DespesaExistente[] {
  return antigas.filter((d) => !novas.some((l) => encontrarCandidatas(l, [d]).length > 0));
}
