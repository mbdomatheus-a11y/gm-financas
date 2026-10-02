import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Frente 2 do plano de 2026-10-02 (claude/plano-fase2-lancamento-2026-10-02.md
 * no projeto Claude): controle de quais entradas (texto/áudio) o lançamento
 * rápido por IA aceita, em dois níveis — o admin do site define o padrão
 * (`configuracoes_acesso_site.ia_lancamento_modo_padrao`), e o admin de cada
 * grupo pode sobrepor pro seu próprio grupo (`configuracoes_casal`, chave
 * "<grupo_id>:ia_lancamento_modo", valor "herdar_site" = sem override, usa o
 * padrão do site). Mesmo padrão de chave/valor já usado em
 * `conciliacao-faturas.functions.ts`.
 *
 * O resultado (`resolverModoIaLancamento`) é usado tanto pela UI (mostrar/
 * esconder os botões de texto/áudio) quanto pelas próprias server functions
 * de IA (`lancamento-ia.functions.ts`) — a UI sozinha não bastaria, porque
 * um usuário determinado poderia chamar a server function direto.
 */
export const MODOS_IA = ["ambos", "somente_texto", "somente_audio", "desabilitado"] as const;
export type ModoIaLancamento = (typeof MODOS_IA)[number];

const CHAVE_GRUPO = (grupoId: string) => `${grupoId}:ia_lancamento_modo`;

export async function grupoDoUsuario(context: {
  supabase: any;
  userId: string;
}): Promise<string | null> {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("grupo_id")
    .eq("id", context.userId)
    .maybeSingle();
  if (error || !data?.grupo_id) return null;
  return data.grupo_id as string;
}

async function exigirAdminDoGrupo(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error || !(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Só o administrador do grupo pode alterar essa configuração.");
  }
}

/** Resolve o modo efetivo pro grupo. Em qualquer erro de leitura, falha
 * "aberto" (devolve "ambos") — consistente com o resto do módulo de IA, que
 * nunca trava o usuário por causa de uma falha de infraestrutura; o controle
 * do admin é uma preferência, não uma trava de segurança crítica. */
export async function resolverModoIaLancamento(
  db: any,
  grupoId: string | null,
): Promise<ModoIaLancamento> {
  if (!grupoId) return "ambos";
  try {
    const [{ data: site }, { data: grupo }] = await Promise.all([
      db
        .from("configuracoes_acesso_site")
        .select("ia_lancamento_modo_padrao")
        .eq("id", true)
        .maybeSingle(),
      db
        .from("configuracoes_casal")
        .select("valor")
        .eq("grupo_id", grupoId)
        .eq("chave", CHAVE_GRUPO(grupoId))
        .maybeSingle(),
    ]);
    const override = grupo?.valor as string | undefined;
    if (
      override &&
      override !== "herdar_site" &&
      (MODOS_IA as readonly string[]).includes(override)
    ) {
      return override as ModoIaLancamento;
    }
    const padraoSite = site?.ia_lancamento_modo_padrao as string | undefined;
    if (padraoSite && (MODOS_IA as readonly string[]).includes(padraoSite)) {
      return padraoSite as ModoIaLancamento;
    }
    return "ambos";
  } catch {
    return "ambos";
  }
}

/** Lido pela UI (`LancamentoRapidoDialog`) pra mostrar/esconder os botões de
 * texto/áudio antes mesmo de tentar usar a IA. */
export const obterModoIaLancamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const grupoId = await grupoDoUsuario(context);
    const modo = await resolverModoIaLancamento(db, grupoId);
    let overrideGrupo: ModoIaLancamento | "herdar_site" = "herdar_site";
    if (grupoId) {
      const { data: grupoRow } = await db
        .from("configuracoes_casal")
        .select("valor")
        .eq("grupo_id", grupoId)
        .eq("chave", CHAVE_GRUPO(grupoId))
        .maybeSingle();
      if (grupoRow?.valor) overrideGrupo = grupoRow.valor;
    }
    return { modo, overrideGrupo };
  });

/** Admin do GRUPO escolhe/limpa o override do próprio grupo. */
export const salvarModoIaLancamentoGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ valor: z.enum([...MODOS_IA, "herdar_site"]) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdminDoGrupo(context);
    const grupoId = await grupoDoUsuario(context);
    if (!grupoId) throw new Error("Grupo do usuário não encontrado.");
    const chave = CHAVE_GRUPO(grupoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    if (data.valor === "herdar_site") {
      const { error } = await db
        .from("configuracoes_casal")
        .delete()
        .eq("grupo_id", grupoId)
        .eq("chave", chave);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("configuracoes_casal")
        .upsert(
          { chave, valor: data.valor, grupo_id: grupoId, updated_at: new Date().toISOString() },
          { onConflict: "chave" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true as const, overrideGrupo: data.valor };
  });

/** Admin do SITE lê/grava o padrão global — mesmo padrão de
 * `obterConfiguracaoAcesso`/`adminAlternarGoogleDriveNotas` de
 * `configuracoes-site.functions.ts` (tabela singleton, checa `site_admins`
 * antes de gravar, loga em `admin_audit_logs`). */
export const adminObterModoIaLancamentoSite = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("configuracoes_acesso_site")
      .select("ia_lancamento_modo_padrao")
      .eq("id", true)
      .single();
    if (error) throw new Error("Não foi possível carregar a configuração.");
    return { modoPadrao: data.ia_lancamento_modo_padrao as ModoIaLancamento };
  },
);

export const adminSalvarModoIaLancamentoSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ modoPadrao: z.enum(MODOS_IA) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: souAdmin } = await db
      .from("site_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!souAdmin) throw new Error("Acesso restrito à administração do site.");
    const { error } = await db
      .from("configuracoes_acesso_site")
      .update({
        ia_lancamento_modo_padrao: data.modoPadrao,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "ia_lancamento_modo_site_atualizado",
      detalhes: { modoPadrao: data.modoPadrao },
    });
    return { ok: true as const };
  });
