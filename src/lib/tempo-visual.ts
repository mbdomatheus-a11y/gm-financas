/**
 * Distinção visual passado/presente/futuro (Bloco 3,
 * `claude/plano-mega-2026-09-14.md`): padrão único pra qualquer gráfico
 * que mostre uma linha do tempo de meses — opacidade reduzida pro que
 * ainda não aconteceu (mês além do mês atual/vigente), e um destaque
 * reservado pro mês atual (cada tela decide a cor do destaque, aqui só a
 * classificação passado/atual/futuro e a opacidade sugerida).
 */
export type PosicaoTemporal = "passado" | "atual" | "futuro";

export function posicaoTemporalDoMes(mesKey: string, mesAtualKey: string): PosicaoTemporal {
  if (mesKey === mesAtualKey) return "atual";
  return mesKey < mesAtualKey ? "passado" : "futuro";
}

/** Opacidade sugerida pra barras/pontos de gráfico, por posição temporal. */
export function opacidadePorPosicao(pos: PosicaoTemporal): number {
  if (pos === "futuro") return 0.5;
  if (pos === "passado") return 0.85;
  return 1;
}

/** Rótulo curto pra indicar visualmente que o mês ainda não aconteceu. */
export function rotuloPorPosicao(pos: PosicaoTemporal): string | null {
  return pos === "futuro" ? "previsto" : null;
}
