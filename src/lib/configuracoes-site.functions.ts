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
    .select("modo_login,segundo_fator_email,sessao_maxima_minutos")
    .eq("id", true)
    .single();
  if (error) throw new Error("Não foi possível carregar a configuração de acesso.");
  return data as {
    modo_login: "cpf" | "email" | "ambos";
    segundo_fator_email: boolean;
    sessao_maxima_minutos: number;
  };
});

export const adminSalvarConfiguracaoAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        modoLogin: z.enum(["cpf", "email", "ambos"]),
        segundoFatorEmail: z.boolean(),
        sessaoMaximaMinutos: z.number().int().min(15).max(480),
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
