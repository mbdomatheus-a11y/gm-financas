import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui/button";

export const CHAVE_AVISO_PRIVACIDADE = "control-all-aviso-privacidade";
/** Rodada em que a pessoa respondeu; o aviso só volta se o admin redisparar (rodada nova). */
const CHAVE_RODADA_PRIVACIDADE = "control-all-aviso-privacidade-rodada";

/** "ok" = aceitou métricas anônimas, "essencial" = só o necessário, null = ainda não escolheu. */
export function escolhaPrivacidade(): "ok" | "essencial" | null {
  try {
    const v = localStorage.getItem(CHAVE_AVISO_PRIVACIDADE);
    return v === "ok" || v === "essencial" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Aviso de privacidade (LGPD). O site usa só armazenamento essencial (login, preferências)
 * e métricas anônimas de acesso, sem cookies de publicidade. A pessoa pode recusar as métricas.
 */
export function AvisoPrivacidade() {
  const [visivel, setVisivel] = useState(false);
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const { data: config, isError } = useQuery({
    queryKey: ["configuracao-acesso-publica"],
    queryFn: () => obterConfig(),
    staleTime: 60_000,
  });
  const rodada = String(config?.rodada_aviso_privacidade ?? 1);

  useEffect(() => {
    if (!config && !isError) return;
    let respondeuRodada = false;
    try {
      // Quem já tinha escolhido antes das rodadas existirem conta como rodada 1.
      const salva = localStorage.getItem(CHAVE_RODADA_PRIVACIDADE) ?? (escolhaPrivacidade() ? "1" : null);
      respondeuRodada = escolhaPrivacidade() !== null && salva === rodada;
    } catch {
      respondeuRodada = false;
    }
    setVisivel(!respondeuRodada);
  }, [config, isError, rodada]);

  function escolher(valor: "ok" | "essencial") {
    try {
      localStorage.setItem(CHAVE_AVISO_PRIVACIDADE, valor);
      localStorage.setItem(CHAVE_RODADA_PRIVACIDADE, rodada);
    } catch {
      /* sem armazenamento: o aviso só fecha */
    }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de privacidade"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border bg-card p-4 shadow-xl sm:left-auto sm:right-4 sm:mx-0 native:bottom-[calc(0.75rem+var(--app-inset-bottom,0px))]"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Sua privacidade</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Usamos apenas o armazenamento essencial para você entrar e guardar suas preferências, e
            métricas anônimas de acesso para melhorar o site. Não usamos cookies de publicidade.{" "}
            <Link to="/privacidade" className="underline">
              Saiba mais
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" className="h-10" onClick={() => escolher("ok")}>
          Aceitar
        </Button>
        <Button size="sm" variant="outline" className="h-10" onClick={() => escolher("essencial")}>
          Só o essencial
        </Button>
      </div>
    </div>
  );
}
