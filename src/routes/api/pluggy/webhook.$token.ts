import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/**
 * Recebe os avisos da Pluggy (item/*, transactions/*). A Pluggy não assina os avisos,
 * então a proteção é: (1) o token secreto na URL (PLUGGY_WEBHOOK_TOKEN), (2) só processar
 * itens já cadastrados em pluggy_items e (3) buscar os dados de novo na API, sem confiar no conteúdo do aviso.
 * Respostas 4xx não são reenviadas pela Pluggy; 5xx são (até 3 vezes), por isso erro de gravação devolve 500.
 */
const EVENTOS = new Set([
  "item/created",
  "item/updated",
  "item/error",
  "transactions/created",
  "transactions/updated",
]);

export const Route = createFileRoute("/api/pluggy/webhook/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const esperado = process.env["PLUGGY_WEBHOOK_TOKEN"];
        if (!esperado || !tokenIgual(params.token, esperado)) {
          return new Response("Not found", { status: 404 });
        }

        let corpo: { event?: string; itemId?: string };
        try {
          corpo = (await request.json()) as { event?: string; itemId?: string };
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        if (!corpo.event || !EVENTOS.has(corpo.event) || !corpo.itemId || !/^[0-9a-f-]{36}$/i.test(corpo.itemId)) {
          return new Response("ignorado", { status: 200 });
        }

        try {
          const { sincronizarItem } = await import("@/lib/pluggy-api.server");
          await sincronizarItem(corpo.itemId);
          return new Response("ok", { status: 200 });
        } catch {
          return new Response("erro temporário", { status: 500 });
        }
      },
    },
  },
});

/** Comparação em tempo constante, para não vazar o token por tempo de resposta. */
function tokenIgual(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
