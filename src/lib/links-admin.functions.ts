import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Links do admin (2026-10-08): o admin do site cria um texto (título + conteúdo
 * com formatação básica) e recebe um link. Só quem está logado abre o link.
 * Tipo "temporário" tem data/hora de expiração escolhida pelo admin;
 * "permanente" não expira. Itens podem ser editados, arquivados e excluídos.
 * A tabela não tem acesso direto pelo navegador: tudo passa por aqui.
 */

type Ctx = { supabase: any; userId: string };

async function ehAdmin(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  return !!data;
}

async function exigirAdmin(context: Ctx) {
  if (!(await ehAdmin(context))) throw new Error("Acesso restrito à administração do site.");
}

const COLUNAS = "id,titulo,conteudo,tipo,expira_em,arquivado,concluida_em,criado_em,atualizado_em";

export const adminListarLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("links_admin")
      .select(COLUNAS)
      .order("criado_em", { ascending: false });
    if (error) throw new Error("Não foi possível carregar os links.");
    return (data ?? []) as {
      id: string;
      titulo: string;
      conteudo: string;
      tipo: "temporario" | "permanente";
      expira_em: string | null;
      arquivado: boolean;
      concluida_em: string | null;
      criado_em: string;
      atualizado_em: string;
    }[];
  });

export const adminSalvarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        titulo: z.string().trim().min(1, "Informe o título.").max(120, "Título com até 120 caracteres."),
        conteudo: z
          .string()
          .trim()
          .min(1, "Informe o conteúdo.")
          .max(100_000, "Conteúdo com até 100.000 caracteres."),
        tipo: z.enum(["temporario", "permanente"]),
        expiraEm: z.string().datetime().nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    let expira: string | null = null;
    if (data.tipo === "temporario") {
      if (!data.expiraEm) throw new Error("Informe a data e a hora de expiração.");
      if (new Date(data.expiraEm).getTime() <= Date.now()) {
        throw new Error("A data de expiração precisa estar no futuro.");
      }
      expira = data.expiraEm;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const base = {
      titulo: data.titulo,
      conteudo: data.conteudo,
      tipo: data.tipo,
      expira_em: expira,
      atualizado_em: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await db.from("links_admin").update(base).eq("id", data.id);
      if (error) throw new Error("Não foi possível salvar.");
      return { id: data.id };
    }
    const { data: novo, error } = await db
      .from("links_admin")
      .insert({ ...base, criado_por: context.userId })
      .select("id")
      .single();
    if (error || !novo) throw new Error("Não foi possível salvar.");
    return { id: novo.id as string };
  });

export const adminArquivarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ id: z.string().uuid(), arquivado: z.boolean() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("links_admin")
      .update({ arquivado: data.arquivado, atualizado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível arquivar.");
    return { ok: true as const };
  });

/** Marca a anotação como analisada (ou reabre). Não apaga nada. */
export const adminConcluirLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ id: z.string().uuid(), concluida: z.boolean() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("links_admin")
      .update({ concluida_em: data.concluida ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar a anotação.");
    return { ok: true as const };
  });

export const adminExcluirLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("links_admin").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível excluir.");
    return { ok: true as const };
  });

/** Módulo "Links" (leitura): lista os links ativos. Admin sempre; demais só com o módulo ligado. */
export const listarLinksAtivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const admin = await ehAdmin(context);
    if (!admin) {
      const [{ data: global }, { data: individual }] = await Promise.all([
        db.from("modulos_globais").select("habilitado").eq("modulo", "links").maybeSingle(),
        db
          .from("modulos_usuario")
          .select("habilitado")
          .eq("user_id", context.userId)
          .eq("modulo", "links")
          .maybeSingle(),
      ]);
      const ligado = individual ? !!individual.habilitado : !!global?.habilitado;
      if (!ligado) return [] as { id: string; titulo: string; criado_em: string }[];
    }
    const { data, error } = await db
      .from("links_admin")
      .select("id,titulo,criado_em,expira_em")
      .eq("arquivado", false)
      .or(`expira_em.is.null,expira_em.gt.${new Date().toISOString()}`)
      .order("criado_em", { ascending: false });
    if (error) throw new Error("Não foi possível carregar os links.");
    return (data ?? []) as { id: string; titulo: string; criado_em: string }[];
  });

/** Abre um link: qualquer pessoa logada. Arquivado só o admin enxerga. */
export const abrirLinkAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await ehAdmin(context);
    const { data: link } = await (supabaseAdmin as any)
      .from("links_admin")
      .select("titulo,conteudo,tipo,expira_em,arquivado,atualizado_em")
      .eq("id", data.id)
      .maybeSingle();
    if (!link || (link.arquivado && !admin)) return { status: "nao_encontrado" as const };
    if (link.expira_em && new Date(link.expira_em).getTime() < Date.now() && !admin) {
      return { status: "expirado" as const };
    }
    return {
      status: "ok" as const,
      titulo: link.titulo as string,
      conteudo: link.conteudo as string,
      atualizadoEm: link.atualizado_em as string,
    };
  });

/**
 * Unifica 2 ou mais anotações em uma nova (permanente). O conteúdo de cada uma
 * entra em ordem de criação, precedido do seu título. As originais são ARQUIVADAS
 * (não apagadas), então dá para conferir no histórico e excluir depois.
 */
export const adminUnificarLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(2, "Escolha ao menos 2 anotações.").max(30),
        titulo: z.string().trim().min(1, "Informe o título.").max(120, "Título com até 120 caracteres."),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: itens, error } = await db
      .from("links_admin")
      .select("id,titulo,conteudo,criado_em")
      .in("id", data.ids)
      .order("criado_em", { ascending: true });
    if (error || !itens || itens.length !== new Set(data.ids).size) {
      throw new Error("Não foi possível localizar todas as anotações.");
    }
    const conteudo = (itens as { titulo: string; conteudo: string }[])
      .map((i) => `# ${i.titulo}\n\n${i.conteudo}`)
      .join("\n\n---\n\n");
    if (conteudo.length > 100_000) {
      throw new Error("A união passa de 100.000 caracteres. Escolha menos anotações.");
    }
    const { data: novo, error: e1 } = await db
      .from("links_admin")
      .insert({
        titulo: data.titulo,
        conteudo,
        tipo: "permanente",
        expira_em: null,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (e1 || !novo) throw new Error("Não foi possível unificar.");
    const { error: e2 } = await db
      .from("links_admin")
      .update({ arquivado: true, atualizado_em: new Date().toISOString() })
      .in("id", data.ids);
    if (e2) throw new Error("A nova anotação foi criada, mas não foi possível arquivar as originais.");
    return { id: novo.id as string };
  });
