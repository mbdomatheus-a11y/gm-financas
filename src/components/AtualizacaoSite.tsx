import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { versaoDoSite } from "@/lib/versao-site.functions";

const INTERVALO_MS = 5 * 60 * 1000;

/**
 * Atualização obrigatória do site (28/10/2026, igual ao app). A cada 5 minutos e ao voltar para a
 * aba, confere se saiu um deploy novo. Se saiu, recarrega sozinho na próxima troca de tela ou quando
 * a pessoa voltar para a aba (nunca no meio de um formulário). Um aviso pequeno fica no topo até lá.
 */
export function AtualizacaoSite() {
  const obter = useServerFn(versaoDoSite);
  const inicial = useRef<string | null>(null);
  const [nova, setNova] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const primeiroPath = useRef(pathname);

  useEffect(() => {
    let vivo = true;
    async function conferir() {
      try {
        const { versao } = await obter();
        if (!vivo || versao === "local") return;
        if (inicial.current == null) inicial.current = versao;
        else if (versao !== inicial.current) setNova(true);
      } catch {
        // sem rede: confere de novo depois
      }
    }
    void conferir();
    const t = window.setInterval(conferir, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (nova) window.location.reload();
      else void conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [obter, nova]);

  // Trocou de tela com versão nova pronta: abre a tela nova já na versão nova.
  useEffect(() => {
    if (nova && pathname !== primeiroPath.current) window.location.reload();
    primeiroPath.current = pathname;
  }, [pathname, nova]);

  if (!nova) return null;
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="fixed left-1/2 top-2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      Nova versão do Control ALL. Toque para atualizar
    </button>
  );
}
