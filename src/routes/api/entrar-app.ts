import { createFileRoute } from "@tanstack/react-router";

/**
 * Login social do app (15/11/2026). O app abre esta página em vez do endereço técnico do banco: assim o
 * aviso do iPhone ("ControlALL deseja usar ... para iniciar sessão") mostra controlall.com.br. Aqui só
 * redirecionamos para o login do provedor; só aceitamos o endereço de login do nosso projeto, com retorno
 * para o próprio app (evita usar esta página para mandar alguém a outro site).
 */
const BASE = "https://wjapagkdgjlavonbmjdu.supabase.co/auth/v1/authorize?";

export const Route = createFileRoute("/api/entrar-app")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("u") ?? "";
        let ok = u.startsWith(BASE);
        if (ok) {
          const destino = new URL(u).searchParams.get("redirect_to") ?? "";
          ok = destino.startsWith("controlall://");
        }
        if (!ok) return new Response("Endereço de login inválido.", { status: 400 });
        return new Response(null, { status: 302, headers: { location: u, "cache-control": "no-store" } });
      },
    },
  },
});
