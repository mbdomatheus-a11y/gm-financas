import { useEffect, useRef, useState } from "react";

/**
 * Site key do Cloudflare Turnstile — pública, pode ficar no código-fonte.
 * Trocada em 2026-09-18 (novo widget Turnstile, criado junto com a
 * reconexão do Supabase externo). A secret key correspondente NÃO fica
 * aqui — só nos Secrets do Lovable / variáveis de ambiente da Vercel,
 * como `TURNSTILE_SECRET_KEY` (ver src/lib/turnstile.functions.ts).
 */
const SITE_KEY = "0x4AAAAAAE7_9ZrRkf0ZfJ7F";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

let carregando: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o Turnstile"));
    document.head.appendChild(script);
  });
  return carregando;
}

/**
 * Widget de verificação anti-bot do Cloudflare Turnstile. Chama `onVerify`
 * com o token gerado (para enviar ao servidor) ou `null` quando expira/erra.
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let cancelado = false;
    carregarScript()
      .then(() => {
        if (cancelado || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token) => onVerify(token),
          "expired-callback": () => onVerify(null),
          "error-callback": () => onVerify(null),
        });
      })
      .catch(() => setErro(true));
    return () => {
      cancelado = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (erro) {
    return (
      <p className="text-xs text-destructive">
        Não foi possível carregar a verificação de segurança. Recarregue a página.
      </p>
    );
  }

  return <div ref={ref} />;
}
