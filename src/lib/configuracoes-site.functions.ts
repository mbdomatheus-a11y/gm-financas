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
      "modo_login,segundo_fator_email,sessao_maxima_minutos,cota_convites,google_drive_habilitado,cadastro_livre_habilitado,tela_inicial_padrao",
    )
    .eq("id", true)
    .single();
  if (error) throw new Error("Não foi possível carregar a configuração de acesso.");
  return {
    ...data,
    cadastro_livre_habilitado: data.cadastro_livre_habilitado ?? true,
  } as {
    modo_login: "cpf" | "email" | "ambos";
    segundo_fator_email: boolean;
    sessao_maxima_minutos: number;
    cota_convites: number;
    google_drive_habilitado: boolean;
    cadastro_livre_habilitado: boolean;
    /** Tela em que o login cai por padrão (Item 1 da Frente 4, plano de
     * 2026-10-02) — ver `src/lib/tela-inicial-padrao.ts`. */
    tela_inicial_padrao: "financas" | "lista-compras" | "notas";
  };
});

export const adminSalvarTelaInicialPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ tela: z.enum(["financas", "lista-compras", "notas"]) }).parse(v),
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
    const [
      { data: globais, error: globalError },
      { data: individuais, error: individualError },
      { data: admin },
    ] = await Promise.all([
      db.from("modulos_globais").select("modulo,nome,habilitado").order("nome"),
      db.from("modulos_usuario").select("modulo,habilitado").eq("user_id", context.userId),
      db.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (globalError || individualError) throw new Error("Não foi possível carregar os módulos.");
    const porModulo = new Map((individuais ?? []).map((x: any) => [x.modulo, x.habilitado]));
    return (globais ?? []).map((x: any) => ({
      ...x,
      liberadoGeral: !!x.habilitado,
      habilitado: !!admin || (porModulo.has(x.modulo) ? porModulo.get(x.modulo) : x.habilitado),
    }));
  });

export const adminListarModulos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: modulos }, { data: excecoes }, { data: perfis }] = await Promise.all([
      db.from("modulos_globais").select("modulo,nome,habilitado").order("nome"),
      db.from("modulos_usuario").select("user_id,modulo,habilitado"),
      db.from("profiles").select("id,nome,email").eq("ativo", true).order("nome"),
    ]);
    return { modulos: modulos ?? [], excecoes: excecoes ?? [], usuarios: perfis ?? [] };
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

    for (const item of upserts) {
      await db.from("configuracoes_casal").upsert(item, { onConflict: "chave" });
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
