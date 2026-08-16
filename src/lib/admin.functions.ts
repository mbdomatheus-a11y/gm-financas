import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SEED = [
  { cpf: "08857166635", nome: "Titular 1" },
  { cpf: "41412522803", nome: "Titular 2" },
];
const DOMAIN = "financascasal.app";

export const ensureSeedUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const seed of SEED) {
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cpf", seed.cpf)
      .maybeSingle();
    if (existing) continue;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${seed.cpf}@${DOMAIN}`,
      password: "admin123",
      email_confirm: true,
    });
    if (error || !created.user) continue;

    await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, nome: seed.nome, cpf: seed.cpf, senha_temporaria: true });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
  }
  return { ok: true };
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        cpf: z.string().regex(/^\d{11}$/),
        role: z.enum(["admin", "comum"]).default("comum"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.cpf}@${DOMAIN}`,
      password: "admin123",
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, nome: data.nome, cpf: data.cpf, senha_temporaria: true });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), senha: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ senha_temporaria: true }).eq("id", data.userId);
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "comum"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    return { ok: true };
  });
