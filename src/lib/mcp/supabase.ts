import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseProjectUrl(): string {
  const value = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!value) throw new Error("A conexão com o banco não está configurada.");
  return value;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;

  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const value = [keys["default"], ...Object.values(keys)].find(
          (item): item is string =>
            typeof item === "string" && item.trim().startsWith("sb_publishable_"),
        );
        if (value) return value.trim();
      }
    } catch {
      // Tenta os nomes legados abaixo.
    }
  }

  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (!legacy) throw new Error("A chave pública do banco não está configurada.");
  return legacy;
}

export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("É necessário entrar no Control ALL.");

  return createClient<Database>(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}