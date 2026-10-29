import { createServerFn } from "@tanstack/react-start";

/** Identificador do deploy atual (commit na Vercel). Usado para o site se atualizar sozinho. */
export const versaoDoSite = createServerFn({ method: "GET" }).handler(async () => ({
  versao: process.env["VERCEL_GIT_COMMIT_SHA"] ?? process.env["VERCEL_DEPLOYMENT_ID"] ?? "local",
}));
