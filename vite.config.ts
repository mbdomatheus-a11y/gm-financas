// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

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

export default defineConfig({
  vite: {
    plugins: [mcpPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(versaoDoCommit()),
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
