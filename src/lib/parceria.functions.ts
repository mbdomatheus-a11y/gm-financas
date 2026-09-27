import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Bloco de parceria/patrocínio discreto na home pública (2026-09-27, a
 * pedido do usuário): um link "patrocinado" pro site de um parceiro
 * (inicialmente piczofertas.com.br), com prévia (print enviado pelo
 * admin — sem geração automática de screenshot), slogan editável e
 * contador de cliques. Mesmo padrão de identidade-site.functions.ts e
 * estatisticas-site.functions.ts: tabela singleton (`parceria_home`),
 * leitura pública via service_role (sem policy de RLS pra anon/authenticated),
 * escrita só pelo admin do site.
 */

async function assertSiteAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Apenas o administrador do site pode ver/alterar a parceria.");
}

/** Leitura pública (home não-autenticada): só o necessário pra exibir o
 * bloco, e só quando `ativo` — nunca expõe o total de cliques aqui. */
export const obterParceriaHome = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("parceria_home")
    .select("url, slogan, preview_imagem_path, ativo")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.ativo || !data.url) return null;
  return {
    url: data.url as string,
    slogan: (data.slogan as string | null) ?? null,
    previewImagemPath: (data.preview_imagem_path as string | null) ?? null,
  };
});

/** Leitura completa pro admin (inclui cliques, mesmo quando inativo). */
export const adminObterParceria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("parceria_home")
      .select("url, slogan, preview_imagem_path, ativo, cliques")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as {
      url: string | null;
      slogan: string | null;
      preview_imagem_path: string | null;
      ativo: boolean;
      cliques: number;
    } | null;
  });

export const adminSalvarParceria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        url: z
          .string()
          .trim()
          .max(500)
          .refine((v) => v === "" || /^https?:\/\//i.test(v), "A URL deve começar com http:// ou https://"),
        slogan: z.string().trim().max(300).nullable(),
        ativo: z.boolean(),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("parceria_home").upsert({
      id: true,
      url: data.url || null,
      slogan: data.slogan || null,
      ativo: data.ativo,
      atualizado_em: new Date().toISOString(),
      atualizado_por: context.userId,
    });
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "parceria_home_atualizada",
      detalhes: { url: data.url, ativo: data.ativo },
    });
    return { ok: true as const };
  });

/** Mesmo padrão de prepararUploadLogo/prepararUploadVideo — bucket
 * `site_assets` (já público, já usado pela logo). */
export const prepararUploadParceriaImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ nome: z.string().min(1).max(140) }).parse(value))
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `parceria/${crypto.randomUUID()}-${data.nome.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: signed, error } = await (supabaseAdmin as any).storage
      .from("site_assets")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const confirmarParceriaImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ path: z.string().regex(/^parceria\/[A-Za-z0-9._-]+$/) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("parceria_home").upsert({
      id: true,
      preview_imagem_path: data.path,
      atualizado_em: new Date().toISOString(),
      atualizado_por: context.userId,
    });
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "parceria_home_imagem_atualizada",
      detalhes: {},
    });
    return { ok: true as const };
  });

/** Público, sem auth — chamado pelo clique no link da home. Incrementa via
 * função de banco (increment_parceria_cliques) pra ser atômico mesmo sob
 * cliques concorrentes. Não retorna nada sensível. */
export const registrarCliqueParceria = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  await db.rpc("increment_parceria_cliques");
  return { ok: true as const };
});
