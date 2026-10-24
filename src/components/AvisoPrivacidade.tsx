import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const CHAVE_AVISO_PRIVACIDADE = "control-all-aviso-privacidade";
/** Rodada em que a pessoa respondeu; o aviso só volta se o admin redisparar (rodada nova). */
const CHAVE_RODADA_PRIVACIDADE = "control-all-aviso-privacidade-rodada";
const EVENTO_ABRIR = "control-all:preferencias-cookies";

/** "ok" = aceitou métricas, "essencial" = só o necessário, null = ainda não escolheu. */
export function escolhaPrivacidade(): "ok" | "essencial" | null {
  try {
    const v = localStorage.getItem(CHAVE_AVISO_PRIVACIDADE);
    return v === "ok" || v === "essencial" ? v : null;
  } catch {
    return null;
  }
}

/** Métricas (log de acessos e Vercel Analytics) só rodam com aceite explícito (LGPD, consentimento). */
export function metricasPermitidas(): boolean {
  return escolhaPrivacidade() === "ok";
}

/** Reabre o aviso já no painel de preferências (rodapé e página /cookies). */
export function abrirPreferenciasCookies() {
  window.dispatchEvent(new Event(EVENTO_ABRIR));
}

/**
 * Aviso de cookies (LGPD), no modelo "Aceitar / Só o essencial / Personalizar".
 * Usamos só o essencial (login, preferências) e, com aceite, métricas de acesso.
 * Marketing e personalização por terceiros aparecem como "Não usamos" para deixar claro.
 */
export function AvisoPrivacidade() {
  const [visivel, setVisivel] = useState(false);
  const [painel, setPainel] = useState(false);
  const [metricas, setMetricas] = useState(false);
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

  useEffect(() => {
    function abrir() {
      setMetricas(metricasPermitidas());
      setPainel(true);
      setVisivel(true);
    }
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  function escolher(valor: "ok" | "essencial") {
    try {
      localStorage.setItem(CHAVE_AVISO_PRIVACIDADE, valor);
      localStorage.setItem(CHAVE_RODADA_PRIVACIDADE, rodada);
    } catch {
      /* sem armazenamento: o aviso só fecha */
    }
    setVisivel(false);
    setPainel(false);
  }

  if (!visivel) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-h-[85vh] max-w-xl overflow-y-auto rounded-2xl border bg-card p-4 shadow-xl sm:left-auto sm:right-4 sm:mx-0 native:bottom-[calc(0.75rem+var(--app-inset-bottom,0px))]"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">{painel ? "Política de Cookies" : "Sua privacidade"}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            {painel ? (
              <>
                Cookies ajudam o site a reconhecer o seu acesso. Escolha o que podemos usar. Saiba mais na{" "}
                <Link to="/cookies" className="underline">Política de Cookies</Link> e na{" "}
                <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
              </>
            ) : (
              <>
                Usamos <Link to="/cookies" className="underline">cookies</Link> essenciais para você entrar e guardar
                preferências e, se você permitir, métricas de acesso para melhorar o site. Não usamos cookies de
                publicidade. Ao continuar, você concorda com a nossa{" "}
                <Link to="/privacidade" className="underline">Política de Privacidade</Link>. Se preferir,{" "}
                <button type="button" className="underline" onClick={() => { setMetricas(metricasPermitidas()); setPainel(true); }}>
                  escolha quais cookies permite
                </button>
                .
              </>
            )}
          </p>
        </div>
      </div>

      {painel ? (
        <div className="mt-3 space-y-2">
          <Categoria titulo="Essenciais" status="Sempre ativos">
            Fundamentais para o site funcionar: manter você conectado, proteger o acesso e lembrar preferências como
            idioma e tema. Sem eles você não consegue entrar nem usar os recursos básicos.
          </Categoria>
          <Categoria
            titulo="Desempenho e métricas"
            controle={<Switch checked={metricas} onCheckedChange={setMetricas} aria-label="Permitir métricas de acesso" />}
          >
            Contam as páginas visitadas e de onde veio a visita, para melhorarmos o site e sabermos se a divulgação
            funciona. Não identificam você para anunciantes.
          </Categoria>
          <Categoria titulo="Marketing e publicidade" status="Não usamos">
            Anúncios conforme os seus interesses. O Control ALL não mostra anúncios nem usa esses cookies.
          </Categoria>
          <Categoria titulo="Personalização por terceiros" status="Não usamos">
            Recomendações a partir do seu comportamento de navegação. Não usamos.
          </Categoria>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button size="sm" className="h-10" onClick={() => escolher(metricas ? "ok" : "essencial")}>
              Salvar preferências
            </Button>
            <Button size="sm" variant="outline" className="h-10" onClick={() => escolher("ok")}>
              Aceitar todos
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" className="h-10" onClick={() => escolher("ok")}>
            Aceitar
          </Button>
          <Button size="sm" variant="outline" className="h-10" onClick={() => escolher("essencial")}>
            Só o essencial
          </Button>
        </div>
      )}
    </div>
  );
}

function Categoria({
  titulo,
  status,
  controle,
  children,
}: {
  titulo: string;
  status?: string;
  controle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{titulo}</p>
        {controle ?? <span className="shrink-0 text-xs font-medium text-muted-foreground">{status}</span>}
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{children}</p>
    </div>
  );
}
