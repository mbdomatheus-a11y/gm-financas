import { createFileRoute } from "@tanstack/react-router";

/** Link "não quero mais receber" dos e-mails de retenção (2026-10-17). Sem login: o token assina o id. */
export const Route = createFileRoute("/api/email/parar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const u = url.searchParams.get("u") ?? "";
        const t = url.searchParams.get("t") ?? "";
        const { tokenCancelamentoValido } = await import("@/lib/retencao-emails.server");
        const pagina = (msg: string, status = 200) =>
          new Response(
            `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Control ALL</title><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:0 16px;color:#1f2937"><h1 style="font-size:20px">Control ALL</h1><p>${msg}</p><p><a href="/conta">Ir para a minha conta</a></p></body></html>`,
            { status, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        if (!/^[0-9a-f-]{36}$/i.test(u) || !tokenCancelamentoValido(u, t)) return pagina("Link inválido ou expirado.", 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any).from("profiles").update({ emails_retencao: false }).eq("id", u);
        return pagina("Pronto. Você não vai mais receber o resumo semanal nem os lembretes de vencimento por e-mail. Dá para religar na tela Conta.");
      },
    },
  },
});
