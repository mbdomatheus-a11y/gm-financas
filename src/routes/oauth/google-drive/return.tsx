import { useEffect, useState } from "react";
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
      erro?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_drive", code: code ?? null, error: erro ?? null },
        window.location.origin,
      );
      if (type === "appUserConnectorOAuthComplete") window.close();
    };

    if (params.get("success") !== "true") {
      const erro =
        params.get("error_description") ??
        params.get("error") ??
        "A autorização não foi concluída no Google.";
      setMessage(erro);
      notify("appUserConnectorOAuthFailed", undefined, erro);
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      const erro = "A autorização terminou sem código de troca.";
      setMessage(erro);
      notify("appUserConnectorOAuthFailed", undefined, erro);
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);


  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
