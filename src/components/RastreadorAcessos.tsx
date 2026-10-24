import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { registrarAcessoSite } from "@/lib/acessos-site.functions";
import { metricasPermitidas } from "@/components/AvisoPrivacidade";
import { origemAcesso, sessaoAcesso, tokenAtual } from "@/lib/funil-cliente";

/** Registra cada página aberta (caminho, origem, sessão anônima e, com login, o usuário) no log de acessos. */
export function RastreadorAcessos() {
  const registrar = useServerFn(registrarAcessoSite);
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!caminho || caminho.startsWith("/api") || caminho.startsWith("/oauth")) return;
    // Métricas só com aceite explícito no aviso de cookies (quem não respondeu ou escolheu "só o essencial" fica de fora).
    if (!metricasPermitidas()) return;
    const { sessao, primeira } = sessaoAcesso();
    const origem = origemAcesso();
    let referrer: string | null = null;
    if (primeira && document.referrer) {
      try {
        const u = new URL(document.referrer);
        referrer = u.host === window.location.host ? null : u.host + u.pathname.slice(0, 80);
      } catch {
        referrer = null;
      }
    }
    // Com login, o token identifica a pessoa no servidor (separa o tráfego da própria administração).
    void tokenAtual().then((token) =>
      registrar({
        data: {
          caminho,
          referrer,
          utmSource: origem.utmSource,
          utmMedium: origem.utmMedium,
          utmCampaign: origem.utmCampaign,
          sessao,
          token,
        },
      }).catch(() => {}),
    );
  }, [caminho, registrar]);

  return null;
}
