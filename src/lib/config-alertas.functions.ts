import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATALOGO_ALERTAS, itemCatalogo, type ConfigAlerta } from "@/lib/alertas-catalogo";

/** Painel de alertas do sistema (14/11/2026). Ver docs/alertas.md. */
async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

export type LinhaAlertaAdmin = ConfigAlerta & { atualizadoPorNome: string | null };

/** Lista do catálogo com a configuração atual e quem alterou por último. */
export const adminListarAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db.from("config_alertas").select("*");
    const porTipo = new Map<string, any>((data ?? []).map((r: any) => [r.tipo, r]));
    const ids = [...new Set((data ?? []).map((r: any) => r.atualizado_por).filter(Boolean))] as string[];
    const nomes = new Map<string, string>();
    if (ids.length) {
      const { data: perfis } = await db.from("profiles").select("id,nome,email").in("id", ids);
      for (const p of perfis ?? []) nomes.set(p.id, p.nome || p.email || "Admin");
    }
    const linhas: LinhaAlertaAdmin[] = CATALOGO_ALERTAS.map((c) => {
      const r = porTipo.get(c.tipo);
      const cfg: ConfigAlerta = r ? { ...c.padrao, ...r, tipo: c.tipo, canais: r.canais ?? [] } : { tipo: c.tipo, ...c.padrao };
      return { ...cfg, atualizadoPorNome: r?.atualizado_por ? (nomes.get(r.atualizado_por) ?? "Admin") : null };
    });
    return { linhas, tabelaFalta: !!error };
  });

const esquema = z.object({
  tipo: z.string().min(2).max(60),
  ativo: z.boolean(),
  frequencia: z.enum(["na_hora", "diaria", "semanal", "quinzenal", "mensal"]),
  dia_semana: z.number().int().min(0).max(6).nullable(),
  dia_mes: z.number().int().min(1).max(31).nullable(),
  hora: z.number().int().min(0).max(23).nullable(),
  antecedencia_dias: z.number().int().min(0).max(90).nullable(),
  canais: z.array(z.enum(["push", "app", "email"])).max(3),
  titulo_modelo: z.string().trim().max(120).nullable(),
});

/** Salva uma linha. Grava com a sessão do admin: a RLS (private.is_admin) e o gatilho carimbam quem alterou. */
export const adminSalvarAlerta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => esquema.parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (!itemCatalogo(data.tipo)) throw new Error("Tipo de alerta desconhecido.");
    const linha = { ...data, titulo_modelo: data.titulo_modelo || null, atualizado_por: context.userId };
    const { error } = await (context.supabase as any).from("config_alertas").upsert(linha, { onConflict: "tipo" });
    if (error) throw new Error(/config_alertas/.test(error.message) ? "Tabela config_alertas ainda não criada (migration 20261114110000)." : error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("admin_audit_logs").insert({ ator_id: context.userId, acao: "config_alerta_alterada", detalhes: linha });
    return { ok: true };
  });

/** Envia um exemplo do alerta só para o próprio admin (push, ou e-mail nos tipos de e-mail). Ignora preferências. */
export const adminTestarAlerta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ tipo: z.string().min(2).max(60) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const item = itemCatalogo(data.tipo);
    if (!item) throw new Error("Tipo de alerta desconhecido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { carregarConfigAlertas, tituloResumo } = await import("@/lib/config-alertas.server");
    const cfg = (await carregarConfigAlertas(db, true)).porTipo.get(data.tipo) ?? { tipo: data.tipo, ...item.padrao };
    const titulo = cfg.frequencia === "na_hora" || item.origem === "email" ? `Teste: ${item.nome}` : `Teste: ${tituloResumo(cfg, 3)}`;
    if (item.origem === "email") {
      const { data: perfil } = await db.from("profiles").select("email").eq("id", context.userId).maybeSingle();
      if (!perfil?.email) throw new Error("Seu perfil não tem e-mail.");
      const { enviarEmail } = await import("@/lib/email.server");
      const r = await enviarEmail({ to: perfil.email, subject: titulo, html: `<p>${item.descricao}</p><p>Este é um envio de teste do painel de alertas.</p>` });
      if (!r.ok) throw new Error(r.erro);
      return { canal: "email" as const, enviados: 1 };
    }
    const { enviarSemFiltro } = await import("@/lib/push.server");
    const r = await enviarSemFiltro(db, [context.userId], { titulo, corpo: item.descricao, destino: "/mais/avisos" });
    return { canal: "push" as const, enviados: r.enviados };
  });
