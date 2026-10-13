import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";
import { transformarCodigo } from "./scripts/i18n/transform.ts";

/**
 * Tradução da interface (2026-10-13): troca os textos de tela dos .tsx por __t("..."),
 * que devolve o texto no idioma escolhido pelo usuário. Ver scripts/i18n/transform.ts.
 * Para desligar num build de emergência: I18N_DESATIVADO=1.
 */
function traducaoInterface(): Plugin {
  return {
    name: "control-all-traducao-interface",
    enforce: "pre",
    transform(codigo, id) {
      if (process.env["I18N_DESATIVADO"] === "1") return null;
      const arquivo = id.split("?")[0]!.replace(/\\/g, "/");
      if (!arquivo.endsWith(".tsx") || !arquivo.includes("/src/")) return null;
      if (/routeTree\.gen|\.test\.|\/integrations\//.test(arquivo)) return null;
      const r = transformarCodigo(codigo, arquivo);
      return r ? { code: r.codigo, map: null } : null;
    },
  };
}

/**
 * Hash do commit atual (curto) + "-dev" se houver mudança não commitada no
 * momento do build. Usado só para o selo de versão no topo da tela
 * (`VersaoBuild`), pra dar pra conferir visualmente se o site que está
 * rodando já reflete o último `git push`/commit, sem precisar adivinhar.
 * Se o `git` não estiver disponível no ambiente de build (ex. checkout sem
 * pasta .git), cai num valor fixo em vez de quebrar o build.
 */
function versaoDoCommit(): string {
  try {
    const hash = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const sujo = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return sujo ? `${hash}-dev` : hash;
  } catch {
    return "sem-git";
  }
}

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    traducaoInterface(),
    tanstackStart({ server: { entry: "server" } }),
    ...(command === "build" ? [nitro({ preset: "vercel" })] : []),
    viteReact(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(versaoDoCommit()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}));
