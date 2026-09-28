import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Bloco de preços da home (2026-09-28): antes hardcoded no componente da
 * landing page, agora editável pelo admin em Administração > Dados Gerais.
 * Mesmo padrão de parceria.functions.ts/estatisticas-site.functions.ts:
 * tabela singleton (`precos_home`), leitura pública via service_role (sem
 * policy de RLS pra anon/authenticated), escrita só pelo admin do site.
 */

type PrecoHome = {
  nome: string;
  preco: number;
  sufixo: string;
  descricao: string;
  itens: string[];
  botaoTexto: string;
};

async function assertSiteAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Apenas o administrador do site pode ver/alterar os preços.");
}

function mapRow(data: any): PrecoHome {
  return {
    nome: data.nome as string,
    preco: Number(data.preco),
    sufixo: data.sufixo as string,
    descricao: data.descricao as string,
    itens: (data.itens as string[]) ?? [],
    botaoTexto: data.botao_texto as string,
  };
}

/** Leitura pública (home não-autenticada). */
export const obterPrecoHome = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("precos_home")
    .select("nome, preco, sufixo, descricao, itens, botao_texto")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data);
});

export const adminObterPrecoHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("precos_home")
      .select("nome, preco, sufixo, descricao, itens, botao_texto")
      .eq("id", true)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  });

export const adminSalvarPrecoHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1).max(60),
        preco: z.number().min(0).max(99999),
        sufixo: z.string().trim().max(20),
        descricao: z.string().trim().max(300),
        itens: z.array(z.string().trim().min(1).max(140)).min(1).max(10),
        botaoTexto: z.string().trim().min(1).max(40),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("precos_home").upsert({
      id: true,
      nome: data.nome,
      preco: data.preco,
      sufixo: data.sufixo,
      descricao: data.descricao,
      itens: data.itens,
      botao_texto: data.botaoTexto,
      atualizado_em: new Date().toISOString(),
      atualizado_por: context.userId,
    });
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "precos_home_atualizado",
      detalhes: { nome: data.nome, preco: data.preco },
    });
    return { ok: true as const };
  });
