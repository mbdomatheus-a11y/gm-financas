import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tela de Administração > Armazenamento Oracle (2026-09-27): permite ao
 * admin do site escolher, grupo a grupo, se o armazenamento Oracle Object
 * Storage está habilitado para aquele grupo familiar, e ajustar a cota em
 * bytes (grupos.oracle_storage_cota_bytes).
 *
 * Cota padrão sugerida ao habilitar: 500 MB por membro do grupo (incluindo
 * o admin do grupo), calculada UMA VEZ no momento de habilitar — depois
 * disso o valor fica fixo em `oracle_storage_cota_bytes` até o admin do
 * site editar manualmente. Não recalcula sozinha se o grupo ganhar ou
 * perder membros depois.
 */

const QUINHENTOS_MB = 500 * 1024 * 1024;

async function assertSiteAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Apenas o administrador do site pode ver/alterar o armazenamento Oracle.");
}

export type GrupoArmazenamentoOracle = {
  grupoId: string;
  nome: string;
  membros: number;
  habilitado: boolean;
  cotaBytes: number;
  usadoBytes: number;
};

/**
 * Lista todos os grupos do site com a contagem de membros, se o Oracle está
 * habilitado, a cota configurada e o uso atual (soma de oracle_storage_arquivos).
 * Admin-only — cruza dados entre grupos.
 */
export const adminListarArmazenamentoOracle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GrupoArmazenamentoOracle[]> => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: grupos, error: gruposError } = await db
      .from("grupos")
      .select("id, nome, oracle_storage_habilitado, oracle_storage_cota_bytes")
      .order("nome");
    if (gruposError) throw new Error(gruposError.message);

    const { data: membrosPorGrupo, error: membrosError } = await db
      .from("profiles")
      .select("grupo_id");
    if (membrosError) throw new Error(membrosError.message);
    const contagemMembros = new Map<string, number>();
    for (const p of membrosPorGrupo ?? []) {
      const gid = p.grupo_id as string | null;
      if (!gid) continue;
      contagemMembros.set(gid, (contagemMembros.get(gid) ?? 0) + 1);
    }

    const { data: arquivos, error: arquivosError } = await db
      .from("oracle_storage_arquivos")
      .select("grupo_id, bytes");
    if (arquivosError) throw new Error(arquivosError.message);
    const usoPorGrupo = new Map<string, number>();
    for (const a of arquivos ?? []) {
      const gid = a.grupo_id as string;
      usoPorGrupo.set(gid, (usoPorGrupo.get(gid) ?? 0) + Number(a.bytes ?? 0));
    }

    return (grupos ?? []).map((g: any) => ({
      grupoId: g.id,
      nome: g.nome,
      membros: contagemMembros.get(g.id) ?? 0,
      habilitado: Boolean(g.oracle_storage_habilitado),
      cotaBytes: Number(g.oracle_storage_cota_bytes ?? QUINHENTOS_MB),
      usadoBytes: usoPorGrupo.get(g.id) ?? 0,
    }));
  });

/**
 * Liga/desliga o Oracle para um grupo. Ao LIGAR, se o grupo ainda não tinha
 * uma cota customizada previamente (ou seja, é a primeira vez), sugere
 * 500MB × número de membros atuais do grupo (mínimo 500MB, caso o grupo
 * esteja momentaneamente sem membros). Ao desligar, mantém a cota salva
 * (não zera), para o caso de o admin religar depois.
 */
export const adminAlternarArmazenamentoOracle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ grupoId: z.string().uuid(), habilitado: z.boolean() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: grupo, error: grupoError } = await db
      .from("grupos")
      .select("oracle_storage_habilitado, oracle_storage_cota_bytes")
      .eq("id", data.grupoId)
      .maybeSingle();
    if (grupoError) throw new Error(grupoError.message);
    if (!grupo) throw new Error("Grupo não encontrado.");

    const patch: Record<string, unknown> = { oracle_storage_habilitado: data.habilitado };

    // Primeira vez habilitando (nunca teve cota customizada = ainda está no
    // valor padrão de 1GB da migração original): sugere 500MB por membro.
    if (data.habilitado && Number(grupo.oracle_storage_cota_bytes) === 1_073_741_824) {
      const { count, error: countError } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("grupo_id", data.grupoId);
      if (countError) throw new Error(countError.message);
      const membros = Math.max(count ?? 0, 1);
      patch["oracle_storage_cota_bytes"] = membros * QUINHENTOS_MB;
    }

    const { error } = await db.from("grupos").update(patch).eq("id", data.grupoId);
    if (error) throw new Error(error.message);

    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: data.habilitado ? "oracle_storage_habilitado" : "oracle_storage_desabilitado",
      detalhes: { grupoId: data.grupoId, ...patch },
    });

    return { ok: true as const };
  });

/** Ajusta manualmente a cota (em MB, convertido para bytes) de um grupo. */
export const adminAjustarCotaOracle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ grupoId: z.string().uuid(), cotaMb: z.number().min(1).max(1_000_000) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await assertSiteAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const cotaBytes = Math.round(data.cotaMb * 1024 * 1024);
    const { error } = await db
      .from("grupos")
      .update({ oracle_storage_cota_bytes: cotaBytes })
      .eq("id", data.grupoId);
    if (error) throw new Error(error.message);

    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "oracle_storage_cota_ajustada",
      detalhes: { grupoId: data.grupoId, cotaBytes },
    });

    return { ok: true as const };
  });
