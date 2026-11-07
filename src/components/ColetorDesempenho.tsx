import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { iniciarColetaDesempenho } from "@/lib/desempenho-coleta";

/** Um lote de Web Vitals por página (troca de rota fecha o lote anterior e abre outro). */
export function ColetorDesempenho() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const parar = iniciarColetaDesempenho();
    return parar;
  }, [caminho]);
  return null;
}
