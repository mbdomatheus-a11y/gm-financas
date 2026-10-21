import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

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
