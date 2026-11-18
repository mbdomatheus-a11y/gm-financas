// LIBERAÇÃO DE MÓDULOS (18/11/2026). Regra pura, sem imports: CÓPIA IDÊNTICA em controlall/src/lib/liberacao-modulos.ts.
// Interruptores no servidor (modulos_globais): a funcionalidade vai na versão da loja e é ligada daqui, sem atualizar o app.
// Ordem: admin do site vê tudo > exceção da pessoa (modulos_usuario) > ligado para todos > testadores > percentual.

export type RegraModulo = { habilitado: boolean; liberado_testadores?: boolean | null; percentual?: number | null };

/** Faixa fixa da pessoa para o módulo (0 a 99). A mesma pessoa cai sempre na mesma faixa (FNV-1a). */
export function faixaDoUsuario(userId: string, modulo: string): number {
  let h = 0x811c9dc5;
  const s = `${modulo}:${userId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

export function moduloLiberado(
  regra: RegraModulo | undefined,
  quem: { userId: string | null; modulo: string; ehTestador: boolean; excecao?: boolean | undefined; siteAdmin?: boolean },
  padrao: boolean,
): boolean {
  if (quem.siteAdmin) return true;
  if (quem.excecao !== undefined) return quem.excecao;
  if (!regra) return padrao;
  if (regra.habilitado) return true;
  if (regra.liberado_testadores && quem.ehTestador) return true;
  const pct = Math.max(0, Math.min(100, Number(regra.percentual ?? 0)));
  return pct > 0 && !!quem.userId && faixaDoUsuario(quem.userId, quem.modulo) < pct;
}
