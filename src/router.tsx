import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // 07/11/2026 (performance, item 03/05): dados ficam frescos por 30 s, então trocar de tela não
  // baixa de novo todas as despesas. As gravações continuam atualizando na hora via invalidateQueries.
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Transição de tela estilo app só dentro do app iOS (classe marcada pelo app nativo).
    defaultViewTransition:
      typeof document !== "undefined" && document.documentElement.classList.contains("native-app"),
  });

  return router;
};
