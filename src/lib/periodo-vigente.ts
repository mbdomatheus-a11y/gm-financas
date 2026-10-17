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

export type CicloInfo = {
  inicio: Date;
  fim: Date;
  diasTotais: number;
  diasCorridos: number;
  diasRestantes: number;
  diaAtualNoCiclo: number;
  rotuloPeriodo: string; // ex: "10/10 a 09/11" ou "01/10 a 31/10"
  diaVirada: number | null;
};

/**
 * Calcula os dados temporais do ciclo vigente conforme o dia de virada (1-28)
 * configurado pelo administrador da conta.
 */
export function calcularCicloVigente(
  referencia: Date = new Date(),
  diaVirada: number | null | undefined,
): CicloInfo {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const hoje = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());

  if (!diaVirada || diaVirada < 1 || diaVirada > 28) {
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const inicio = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0);
    const diasTotais = fim.getDate();
    const diasCorridos = Math.max(1, hoje.getDate());
    const diasRestantes = Math.max(0, diasTotais - diasCorridos);
    const rotuloPeriodo = `${pad2(inicio.getDate())}/${pad2(inicio.getMonth() + 1)} a ${pad2(fim.getDate())}/${pad2(fim.getMonth() + 1)}`;

    return {
      inicio,
      fim,
      diasTotais,
      diasCorridos,
      diasRestantes,
      diaAtualNoCiclo: diasCorridos,
      rotuloPeriodo,
      diaVirada: null,
    };
  }

  let inicio: Date;
  let fim: Date;

  if (hoje.getDate() < diaVirada) {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, diaVirada);
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), diaVirada - 1);
  } else {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), diaVirada);
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVirada - 1);
  }

  const msPorDia = 24 * 60 * 60 * 1000;
  const diasTotais = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / msPorDia) + 1);
  const diasCorridos = Math.max(1, Math.min(diasTotais, Math.round((hoje.getTime() - inicio.getTime()) / msPorDia) + 1));
  const diasRestantes = Math.max(0, diasTotais - diasCorridos);
  const rotuloPeriodo = `${pad2(inicio.getDate())}/${pad2(inicio.getMonth() + 1)} a ${pad2(fim.getDate())}/${pad2(fim.getMonth() + 1)}`;

  return {
    inicio,
    fim,
    diasTotais,
    diasCorridos,
    diasRestantes,
    diaAtualNoCiclo: diasCorridos,
    rotuloPeriodo,
    diaVirada,
  };
}

/**
 * Hook para obter as informações completas do ciclo configurado pelo usuário.
 */
export function useCicloVigente(): CicloInfo {
  const { prefs } = usePreferencias();
  return calcularCicloVigente(new Date(), prefs.dia_virada);
}
