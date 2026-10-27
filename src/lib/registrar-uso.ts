import { registrarAcessoSite } from "@/lib/acessos-site.functions";
import { metricasPermitidas } from "@/components/AvisoPrivacidade";
import { tokenAtual } from "@/lib/funil-cliente";

/**
 * Registra um evento de uso no mesmo log das telas (27/10/2026), ex.: "/evento/aviso-beta/exibido".
 * Só o nome do evento e quem estava logado; nunca dado lançado.
 */
export function registrarEventoUso(evento: string): void {
  if (typeof window === "undefined") return;
  void tokenAtual()
    .then((token) => {
      if (!token) return;
      return registrarAcessoSite({
        data: {
          caminho: `/evento/${evento}`.slice(0, 300),
          token,
          metricas: metricasPermitidas(),
          plataforma: (window as unknown as { __controlAllApp?: unknown }).__controlAllApp ? "app" : "site",
        },
      });
    })
    .catch(() => {});
}
