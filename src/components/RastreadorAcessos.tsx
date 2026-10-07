import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { registrarAcessoSite } from "@/lib/acessos-site.functions";

/** Registra cada página aberta (caminho, origem e sessão anônima) no log de acessos. */
export function RastreadorAcessos() {
  const registrar = useServerFn(registrarAcessoSite);
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!caminho || caminho.startsWith("/api") || caminho.startsWith("/oauth")) return;
    let sessao: string | null = null;
    let primeira = false;
    try {
      sessao = sessionStorage.getItem("control-all-sessao-acesso");
      if (!sessao) {
        sessao = crypto.randomUUID();
        sessionStorage.setItem("control-all-sessao-acesso", sessao);
        primeira = true;
      }
    } catch {
      // sem armazenamento: registra sem sessão
    }
    const params = new URLSearchParams(window.location.search);
    let referrer: string | null = null;
    if (primeira && document.referrer) {
      try {
        const u = new URL(document.referrer);
        referrer = u.host === window.location.host ? null : u.host + u.pathname.slice(0, 80);
      } catch {
        referrer = null;
      }
    }
    registrar({
      data: {
        caminho,
        referrer,
        utmSource: params.get("utm_source"),
        utmMedium: params.get("utm_medium"),
        utmCampaign: params.get("utm_campaign"),
        sessao,
      },
    }).catch(() => {});
  }, [caminho, registrar]);

  return null;
}
