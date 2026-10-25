import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cria o connect token do Pluggy Connect para a conexão iniciada pelo app.
 * Usa a mesma chave da Pluggy que o site usa (PLUGGY_CLIENT_ID/SECRET da Vercel), assim a conexão
 * fica visível para as sincronizações do site. O app chama aqui com um token assinado pela
 * service role (mesma chave que o app já tem), válido por 2 minutos.
 */
const BASE = "https://api.pluggy.ai";
const CORS = { "Access-Control-Allow-Origin": "*" };

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function usuarioDoToken(tok: string | null): string | null {
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!tok || !chave || tok.length > 600) return null;
  const [corpo, sig] = tok.split(".");
  if (!corpo || !sig) return null;
  const esperado = createHmac("sha256", "pluggy-site:" + chave).update(corpo).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    if (p.k !== "site" || typeof p.u !== "string" || typeof p.e !== "number" || p.e < Date.now()) return null;
    return p.u as string;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/pluggy/conectar")({
  server: {
    handlers: {
      OPTIONS: async () => new Response("ok", { headers: { ...CORS, "Access-Control-Allow-Headers": "content-type" } }),
      GET: async ({ request }) => {
        const uid = usuarioDoToken(new URL(request.url).searchParams.get("s"));
        if (!uid) return json({ erro: "Link inválido ou expirado. Volte ao app e tente de novo." }, 403);

        const { ehAdminPrincipal } = await import("@/lib/conta-exclusao.server");
        if (!(await ehAdminPrincipal(uid))) return json({ erro: "Recurso restrito ao administrador principal." }, 403);

        const clientId = process.env["PLUGGY_CLIENT_ID"];
        const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
        if (!clientId || !clientSecret) return json({ erro: "Credenciais da Pluggy não configuradas no site." }, 500);

        const auth = await fetch(`${BASE}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, clientSecret }),
        });
        if (!auth.ok) return json({ erro: "A Pluggy recusou as credenciais do site." }, 500);
        const { apiKey } = (await auth.json()) as { apiKey?: string };
        if (!apiKey) return json({ erro: "Resposta inesperada da Pluggy." }, 500);

        const r = await fetch(`${BASE}/connect_token`, {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ options: { clientUserId: uid, avoidDuplicates: true } }),
        });
        if (!r.ok) return json({ erro: `Falha ao criar a conexão na Pluggy (${r.status}).` }, 500);
        const j = (await r.json()) as { accessToken: string };
        return json({ accessToken: j.accessToken }, 200);
      },
    },
  },
});
