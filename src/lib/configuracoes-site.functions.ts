import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODULOS = [
  "financas",
  "lista",
  "notas",
  "calculadora",
  "pet",
  "onde_esta",
  "veiculo",
  "exames",
  "links",
  "open_finance",
] as const;

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

export const obterConfiguracaoAcesso = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("configuracoes_acesso_site")
    .select(
      "modo_login,segundo_fator_email,sessao_maxima_minutos,cota_convites,google_drive_habilitado,cadastro_livre_habilitado,tela_inicial_padrao,rodada_aviso_convite,rodada_aviso_privacidade,rodada_aviso_beta,beta_android_aberto",
    )
    .eq("id", true)
    .single();
  if (error) throw new Error("Não foi possível carregar a configuração de acesso.");
  return {
    ...data,
    cadastro_livre_habilitado: data.cadastro_livre_habilitado ?? true,
    beta_android_aberto: data.beta_android_aberto ?? false,
  } as {
    /** Vagas do beta Android abertas no site (o admin liga quando o Google aprova o teste fechado). */
    beta_android_aberto: boolean;
    modo_login: "cpf" | "email" | "ambos";
    segundo_fator_email: boolean;
    sessao_maxima_minutos: number;
    cota_convites: number;
    google_drive_habilitado: boolean;
    cadastro_livre_habilitado: boolean;
    /** Tela em que o login cai por padrão (Item 1 da Frente 4, plano de
     * 2026-10-02) — ver `src/lib/tela-inicial-padrao.ts`. */
    tela_inicial_padrao: "inicio" | "financas" | "lista-compras" | "notas";
    /** Rodada dos avisos dispensáveis: o admin aumenta para mostrar de novo a todos. */
    rodada_aviso_convite: number;
    rodada_aviso_privacidade: number;
    /** Aviso do app beta: 0 = ainda não disparado; o admin dispara e cada disparo é uma rodada. */
    rodada_aviso_beta: number;
  };
});

/** Admin: mostra de novo um aviso dispensável para todos (convite de amigos ou cookies). */
export const adminRedispararAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ aviso: z.enum(["convite", "privacidade", "beta"]) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const coluna =
      data.aviso === "convite" ? "rodada_aviso_convite" : data.aviso === "beta" ? "rodada_aviso_beta" : "rodada_aviso_privacidade";
    const { data: atual, error: erroLeitura } = await db
      .from("configuracoes_acesso_site")
      .select(coluna)
      .eq("id", true)
      .single();
    if (erroLeitura) throw new Error(erroLeitura.message);
    const nova = Number(atual?.[coluna] ?? (data.aviso === "beta" ? 0 : 1)) + 1;
    const { error } = await db
      .from("configuracoes_acesso_site")
      .update({ [coluna]: nova, atualizado_em: new Date().toISOString(), atualizado_por: context.userId })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "aviso_redisparado",
      detalhes: { aviso: data.aviso, rodada: nova },
    });
    return { ok: true as const, rodada: nova };
  });

export const adminSalvarTelaInicialPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ tela: z.enum(["inicio", "financas", "lista-compras", "notas"]) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("configuracoes_acesso_site")
      .update({
        tela_inicial_padrao: data.tela,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "tela_inicial_padrao_alterada",
      detalhes: { tela: data.tela },
    });
    return { ok: true as const };
  });

export const adminAlternarGoogleDriveNotas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ habilitado: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("configuracoes_acesso_site")
      .update({
        google_drive_habilitado: data.habilitado,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "google_drive_notas_alternado",
      detalhes: { habilitado: data.habilitado },
    });
    return { ok: true as const };
  });

/** Abre ou fecha as vagas do beta Android no site (28/10/2026). */
export const adminAlternarBetaAndroid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ aberto: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("configuracoes_acesso_site")
      .update({ beta_android_aberto: data.aberto, atualizado_em: new Date().toISOString(), atualizado_por: context.userId })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({ ator_id: context.userId, acao: "beta_android_alternado", detalhes: { aberto: data.aberto } });
    return { ok: true as const };
  });

export const adminSalvarConfiguracaoAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        modoLogin: z.enum(["cpf", "email", "ambos"]),
        segundoFatorEmail: z.boolean(),
        sessaoMaximaMinutos: z.number().int().min(15).max(480),
        cotaConvites: z.number().int().min(1).max(1000),
        cadastroLivreHabilitado: z.boolean().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("configuracoes_acesso_site").upsert({
      id: true,
      modo_login: data.modoLogin,
      segundo_fator_email: data.segundoFatorEmail,
      sessao_maxima_minutos: data.sessaoMaximaMinutos,
      cota_convites: data.cotaConvites,
      ...(data.cadastroLivreHabilitado !== undefined
        ? { cadastro_livre_habilitado: data.cadastroLivreHabilitado }
        : {}),
      atualizado_em: new Date().toISOString(),
      atualizado_por: context.userId,
    });
    if (error) throw new Error(error.message);
    await db
      .from("admin_audit_logs")
      .insert({ ator_id: context.userId, acao: "configuracao_acesso_atualizada", detalhes: data });
    return { ok: true as const };
  });

export const listarModulosDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // 18/11/2026: com testadores e liberação por porcentagem (lib/liberacao-modulos.ts, igual no app).
    let globaisR = await db.from("modulos_globais").select("modulo,nome,habilitado,liberado_testadores,percentual").order("nome");
    if (globaisR.error) globaisR = await db.from("modulos_globais").select("modulo,nome,habilitado").order("nome");
    const [{ data: individuais, error: individualError }, { data: admin }, testadorR] = await Promise.all([
      db.from("modulos_usuario").select("modulo,habilitado").eq("user_id", context.userId),
      db.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle(),
      db.from("testadores_app").select("user_id").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (globaisR.error || individualError) throw new Error("Não foi possível carregar os módulos.");
    const { moduloLiberado } = await import("@/lib/liberacao-modulos");
    const ehTestador = !testadorR.error && !!testadorR.data;
    const porModulo = new Map<string, boolean>((individuais ?? []).map((x: any) => [String(x.modulo), !!x.habilitado]));
    return (globaisR.data ?? []).map((x: any) => ({
      ...x,
      liberadoGeral: !!x.habilitado,
      habilitado: moduloLiberado(
        x,
        { userId: context.userId, modulo: x.modulo, ehTestador, excecao: porModulo.get(x.modulo), siteAdmin: !!admin },
        !!x.habilitado,
      ),
    }));
  });

export const adminListarModulos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    let modulosR = await db.from("modulos_globais").select("modulo,nome,habilitado,liberado_testadores,percentual").order("nome");
    const liberacaoPronta = !modulosR.error;
    if (modulosR.error) modulosR = await db.from("modulos_globais").select("modulo,nome,habilitado").order("nome");
    const [{ data: excecoes }, { data: perfis }, testR] = await Promise.all([
      db.from("modulos_usuario").select("user_id,modulo,habilitado"),
      db.from("profiles").select("id,nome,email").eq("ativo", true).order("nome"),
      db.from("testadores_app").select("user_id"),
    ]);
    return {
      modulos: modulosR.data ?? [],
      excecoes: excecoes ?? [],
      usuarios: perfis ?? [],
      testadores: testR.error ? [] : ((testR.data ?? []) as { user_id: string }[]).map((t) => t.user_id),
      liberacaoPronta: liberacaoPronta && !testR.error,
    };
  });

export const adminSalvarModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        modulo: z.enum(MODULOS),
        habilitado: z.boolean(),
        userId: z.string().uuid().nullable(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    if (data.userId) {
      const { error } = await db.from("modulos_usuario").upsert({
        user_id: data.userId,
        modulo: data.modulo,
        habilitado: data.habilitado,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("modulos_globais")
        .update({
          habilitado: data.habilitado,
          atualizado_em: new Date().toISOString(),
          atualizado_por: context.userId,
        })
        .eq("modulo", data.modulo);
      if (error) throw new Error(error.message);
    }
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "modulo_acesso_atualizado",
      alvo_id: data.userId,
      detalhes: {
        modulo: data.modulo,
        habilitado: data.habilitado,
        escopo: data.userId ? "usuario" : "global",
      },
    });
    return { ok: true as const };
  });

/** 18/11/2026: liberar um módulo desligado para os testadores e/ou para uma porcentagem das pessoas. */
export const adminSalvarLiberacaoModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        modulo: z.enum(MODULOS),
        liberado_testadores: z.boolean().optional(),
        percentual: z.number().int().min(0).max(100).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const mudar: Record<string, unknown> = { atualizado_em: new Date().toISOString(), atualizado_por: context.userId };
    if (data.liberado_testadores !== undefined) mudar["liberado_testadores"] = data.liberado_testadores;
    if (data.percentual !== undefined) mudar["percentual"] = data.percentual;
    const { error } = await db.from("modulos_globais").update(mudar).eq("modulo", data.modulo);
    if (error) throw new Error("Rode o SQL docs/sql/2026-11-18-liberacao-modulos.sql antes de usar esta opção.");
    await db.from("admin_audit_logs").insert({ ator_id: context.userId, acao: "modulo_liberacao_atualizada", detalhes: data });
    return { ok: true as const };
  });

/** 18/11/2026: marcar ou desmarcar uma pessoa como testadora (vê os módulos liberados para testadores). */
export const adminDefinirTestador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ userId: z.string().uuid(), testador: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = data.testador
      ? await db.from("testadores_app").upsert({ user_id: data.userId, criado_por: context.userId })
      : await db.from("testadores_app").delete().eq("user_id", data.userId);
    if (error) throw new Error("Rode o SQL docs/sql/2026-11-18-liberacao-modulos.sql antes de usar esta opção.");
    await db.from("admin_audit_logs").insert({ ator_id: context.userId, acao: "testador_atualizado", alvo_id: data.userId, detalhes: data });
    return { ok: true as const };
  });

export const adminLimparExcecaoModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ modulo: z.enum(MODULOS), userId: z.string().uuid() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("modulos_usuario")
      .delete()
      .eq("user_id", data.userId)
      .eq("modulo", data.modulo);
    return { ok: true as const };
  });

export const obterProtecaoAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data } = await db
      .from("configuracoes_casal")
      .select("chave,valor")
      .in("chave", ["admin_protecao_tipo", "admin_pin_hash"]);
    const map = new Map((data ?? []).map((d: any) => [d.chave, d.valor]));
    const tipo = (map.get("admin_protecao_tipo") ?? "senha") as "nenhuma" | "senha" | "pin";
    const temPin = Boolean(map.get("admin_pin_hash"));
    return { tipo, temPin };
  });

export const salvarProtecaoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      tipo: z.enum(["nenhuma", "senha", "pin"]),
      pin: z.string().regex(/^\d{4}$/, "PIN deve conter exatamente 4 dígitos").optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const upserts: Array<{ chave: string; valor: string | null; updated_at: string }> = [
      {
        chave: "admin_protecao_tipo",
        valor: data.tipo,
        updated_at: new Date().toISOString(),
      },
    ];

    if (data.pin) {
      const crypto = await import("node:crypto");
      const pinHash = crypto.createHash("sha256").update(data.pin).digest("hex");
      upserts.push({
        chave: "admin_pin_hash",
        valor: pinHash,
        updated_at: new Date().toISOString(),
      });
    }

    // Um único upsert em lote (antes: uma ida ao banco por item).
    if (upserts.length > 0) {
      await db.from("configuracoes_casal").upsert(upserts, { onConflict: "chave" });
    }

    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "admin_protecao_alterada",
      detalhes: { tipo: data.tipo, pinDefinido: Boolean(data.pin) },
    });

    return { ok: true as const };
  });

export const verificarPinAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      pin: z.string().min(1),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row } = await db
      .from("configuracoes_casal")
      .select("valor")
      .eq("chave", "admin_pin_hash")
      .maybeSingle();

    if (!row?.valor) {
      return { valido: false, semPinConfigurado: true };
    }

    const crypto = await import("node:crypto");
    const digitadoHash = crypto.createHash("sha256").update(data.pin).digest("hex");
    const valido = digitadoHash === row.valor;
    return { valido, semPinConfigurado: false };
  });

/**
 * Admin: redefine os avisos de um usuário (ou de todos) para aparecerem de novo (28/10/2026, para
 * gravar vídeos). Apaga o que fica na conta (avisos dispensados e tour concluído) e registra um
 * pedido em avisos_redefinicoes; o site e o app limpam o que fica no aparelho na próxima abertura.
 */
export const adminRedefinirAvisosUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ alvo: z.union([z.literal("todos"), z.string().uuid()]) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const todos = data.alvo === "todos";
    const filtrar = (q: any) => (todos ? q.not("user_id", "is", null) : q.eq("user_id", data.alvo));
    const { error: erroDispensados } = await filtrar(db.from("avisos_dispensados").delete());
    if (erroDispensados) throw new Error(erroDispensados.message);
    const { error: erroTour } = await filtrar(db.from("tour_concluido").delete());
    if (erroTour) throw new Error(erroTour.message);
    const { error } = await db
      .from("avisos_redefinicoes")
      .insert({ alvo_user_id: todos ? null : data.alvo, criado_por: context.userId });
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "avisos_redefinidos",
      detalhes: { alvo: data.alvo },
    });
    return { ok: true as const };
  });
