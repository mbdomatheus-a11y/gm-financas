import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/google-drive/return")({
  ssr: false,
  component: OAuthReturn,
  head: () => ({
    meta: [
      { title: "Conectando o Google Drive" },
      { name: "description", content: "Finalizando a conexão com o Google Drive." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finalizando conexão…");
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
      state?: string,
      erro?: string,
    ) => {
      window.opener?.postMessage(
        {
          type,
          connectorId: "google_drive",
          code: code ?? null,
          state: state ?? null,
          error: erro ?? null,
        },
        window.location.origin,
      );
      if (type === "appUserConnectorOAuthComplete") window.close();
    };

    window.history.replaceState(null, "", window.location.pathname);
    if (params.get("error")) {
      const erro =
        params.get("error_description") ??
        params.get("error") ??
        "A autorização não foi concluída no Google.";
      setMessage(erro);
      notify("appUserConnectorOAuthFailed", undefined, undefined, erro);
      return;
    }
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      const erro = "A autorização terminou sem código de segurança. Tente novamente.";
      setMessage(erro);
      notify("appUserConnectorOAuthFailed", undefined, undefined, erro);
      return;
    }
    notify("appUserConnectorOAuthComplete", code, state);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
