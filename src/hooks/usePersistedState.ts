import { useEffect, useState } from "react";

/**
 * Item 3 (backlog 2026-09-27): estado de tela (filtro, aba ativa, modo de
 * exibição etc.) que persiste no navegador (localStorage) e é restaurado
 * automaticamente na próxima vez que a tela é aberta — generaliza o mesmo
 * padrão já usado nesta sessão em preferências pontuais (ex.: item 4 —
 * `usePrivacidadeValores` —, item 10 — "Agrupamentos" recolhidos no
 * Dashboard), pra qualquer filtro/estado de tela que precise disso.
 *
 * `key` deve ser único por tela+campo (ex.: "despesas.filtroCategoria").
 * Falha silenciosa se localStorage não estiver disponível (SSR, modo
 * privado, quota excedida etc.) — nesse caso comporta-se como um `useState`
 * comum, sempre partindo de `defaultValue`.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignora falhas de localStorage (modo privado, quota etc.)
    }
  }, [key, state]);

  return [state, setState] as const;
}
