import { monthKey } from "@/lib/format";
import { usePreferencias } from "@/hooks/usePreferencias";

/**
 * Item 5 do backlog 2026-09-27: "mês do sistema" customizável por dia de
 * virada, substituindo o mês calendário como "mês atual" nas telas que já
 * usavam `currentMonthKey()`.
 *
 * Regra: com um dia de virada D configurado, o ciclo vai de D deste mês até
 * D-1 do mês seguinte, e é rotulado pelo mês em que o ciclo COMEÇA — ex.:
 * virada dia 10, hoje 5 de outubro → ainda estamos no ciclo que começou em
 * 10/setembro, então a competência vigente é "setembro" ("AAAA-09"), não
 * "outubro". `diaVirada` null/undefined (ou fora de 1-28) mantém o mês
 * calendário normal.
 */
export function competenciaVigente(
  referencia: Date,
  diaVirada: number | null | undefined,
): string {
  if (!diaVirada || diaVirada < 1 || diaVirada > 28) return monthKey(referencia);
  if (referencia.getDate() < diaVirada) {
    return monthKey(new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1));
  }
  return monthKey(referencia);
}

/**
 * Próxima data em que o "mês do sistema" vira, a partir de `referencia`.
 * Edge case confirmado com o usuário (mesma regra do item 17): sempre
 * aponta pro próximo dia de virada FUTURO — nunca uma data já passada. Se
 * hoje já é o próprio dia de virada, considera que o ciclo já virou hoje e
 * aponta pro mês seguinte.
 */
export function proximaVirada(referencia: Date, diaVirada: number): Date {
  const candidato = new Date(referencia.getFullYear(), referencia.getMonth(), diaVirada);
  if (candidato <= referencia) {
    return new Date(referencia.getFullYear(), referencia.getMonth() + 1, diaVirada);
  }
  return candidato;
}

/**
 * Hook: competência vigente considerando a preferência do usuário. Durante
 * o carregamento da preferência (ou sem preferência salva), cai no mês
 * calendário normal — nunca trava a tela esperando a preferência carregar.
 */
export function useCompetenciaVigente(): string {
  const { prefs } = usePreferencias();
  return competenciaVigente(new Date(), prefs.dia_virada);
}
