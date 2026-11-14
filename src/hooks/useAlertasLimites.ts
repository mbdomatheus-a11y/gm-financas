import { useMemo } from "react";

import { formatBRL } from "@/lib/format";

import { useUsoDosLimites, type UsoLimite } from "@/hooks/useLimites";
import { usePreferenciasNotificacao } from "@/hooks/usePreferenciasNotificacao";

/**
 * Alertas de limite de gastos para o sino (07/11/2026). Mesmo formato dos avisos do AlertsBell
 * ({ chave, texto, destino }). A chave inclui a competência e o status, então o aviso volta a
 * aparecer como não lido quando o limite passa de "alerta" para "estourado" ou num ciclo novo.
 */
export type AlertaLimite = { chave: string; texto: string; destino: "/limites" };

const brl = (v: number) => formatBRL(v);

/** Função pura: limites em "alerta" ou "estourado" viram itens do sino. */
export function alertasDosLimites(usos: UsoLimite[], competencia: string): AlertaLimite[] {
  return usos
    .filter((u) => u.status === "alerta" || u.status === "estourado")
    .map((u) => {
      const pct = Math.round(u.percentual);
      const texto =
        u.status === "estourado"
          ? `${u.limite.categoria}: limite estourado (${pct}%), ${brl(Math.abs(u.restante))} acima`
          : `${u.limite.categoria}: ${pct}% do limite usado, restam ${brl(u.restante)}`;
      return {
        chave: `limite:${u.limite.id}:${competencia}:${u.status}`,
        texto,
        destino: "/limites" as const,
      };
    });
}

/**
 * Alertas de limite do ciclo atual, só quando as preferências permitem "limite_perto".
 * Tabela de limites ou de preferências pendente (migration não aplicada): lista vazia.
 */
export function useAlertasLimites(): AlertaLimite[] {
  const { usos, competencia, tabelaPendente, pronto } = useUsoDosLimites();
  const notif = usePreferenciasNotificacao();
  const permitido = !notif.tabelaPendente && !notif.carregando && notif.prefs.lembretes.limite_perto !== false;
  return useMemo(() => {
    if (!permitido || tabelaPendente || !pronto) return [];
    return alertasDosLimites(usos, competencia);
  }, [permitido, tabelaPendente, pronto, usos, competencia]);
}
