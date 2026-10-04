import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Itens 1 e 2 do backlog de 2026-09-26: um valor de "economia total" (ex.:
 * anuidades isentadas, serviços cancelados) exibido publicamente na home,
 * pra qualquer visitante — pensado como prova social ("olha quanto nossos
 * usuários já economizaram"). Segue o mesmo padrão de
 * identidade-site.functions.ts: tabela singleton com leitura pública e
 * escrita só pelo admin do site (via service_role).
 *
 * O valor "automático" (calculado aqui, cruzando TODOS os grupos — só
 * possível via service_role, porque RLS restringe despesas ao próprio
 * grupo) é só uma REFERÊNCIA pro admin: quem decide o que é exibido de
 * fato é o campo salvo em `estatisticas_site_publicas`, que o admin edita
 * livremente (pode aceitar o valor automático, arredondar, ajustar por
 * algum motivo, etc.).
 */

async function assertSiteAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Apenas o administrador do site pode ver/alterar esta estatística.");
}

/**
 * Soma o valor de despesas fixas (recorrentes) marcadas como "Economia
 * Conquistada" em TODOS os grupos do site — cruza dados entre grupos, por
 * isso é admin-only e usa supabaseAdmin (service_role). Só soma despesas em
 * BRL: misturar BRL e USD sem uma cotação de referência do servidor daria
 * um número artificialmente impreciso, e este valor já é só uma referência
 * (o admin decide o valor final exibido).
 */
export const obterEconomiaTotalAutomatica = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("despesas")
      .select("valor_total")
      .eq("economia_conquistada", true)
      .eq("tipo", "fixa")
      .eq("moeda", "BRL");
    if (error) throw new Error(error.message);
    const total = (data ?? []).reduce((s: number, d: any) => s + Number(d.valor_total ?? 0), 0);
    return { total, quantidade: data?.length ?? 0 };
  });

export const obterEstatisticaPublica = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("estatisticas_site_publicas")
    .select("economia_total_exibida")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { economiaTotalExibida: (data?.economia_total_exibida as number | null) ?? null };
});

export const adminSalvarEstatisticaPublica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ valor: z.number().min(0).max(999_999_999).nullable() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("estatisticas_site_publicas").upsert({
      id: true,
      economia_total_exibida: data.valor,
      economia_total_atualizado_em: new Date().toISOString(),
      economia_total_atualizado_por: context.userId,
    });
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "estatistica_publica_atualizada",
      detalhes: { valor: data.valor },
    });
    return { ok: true as const };
  });
