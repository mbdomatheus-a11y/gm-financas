import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailAdmin = "mbdo.matheus@gmail.com";
const pedidoSchema = z.object({ email: z.string().trim().email(), telefone: z.string().trim().min(8).max(24), cpf: z.string().regex(/^\d{11}$/), motivo: z.string().trim().max(2000).optional() });
const cpfHash = (cpf: string) => createHash("sha256").update(cpf).digest("hex");

export const enviarSolicitacaoPrivacidade = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => pedidoSchema.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pedido, error } = await (supabaseAdmin as any).from("solicitacoes_privacidade").insert({ ...data, cpf_hash: cpfHash(data.cpf), tipo: "exclusao" }).select("protocolo").single();
    if (error) throw new Error("Não foi possível registrar a solicitação.");
    const { enviarEmail } = await import("@/lib/email.server");
    await enviarEmail({ to: emailAdmin, subject: "Control ALL: nova solicitação de privacidade", html: `<p>Há uma nova solicitação de exclusão. Protocolo: <strong>${pedido.protocolo}</strong>.</p>` });
    return { protocolo: pedido.protocolo as string };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

export const adminListarSolicitacoesPrivacidade = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context); const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).from("solicitacoes_privacidade").select("id,protocolo,email,telefone,tipo,motivo,status,resposta_admin,criado_em,atualizado_em").order("criado_em", { ascending: false });
  if (error) throw new Error(error.message); return data ?? [];
});

export const adminTratarSolicitacaoPrivacidade = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["em_analise","concluida","indeferida"]), resposta: z.string().trim().max(2000).optional() }).parse(v)).handler(async ({ data, context }) => {
  await assertAdmin(context); const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any).from("solicitacoes_privacidade").update({ status: data.status, resposta_admin: data.resposta ?? null, tratado_por: context.userId, atualizado_em: new Date().toISOString() }).eq("id", data.id); if (error) throw new Error(error.message); return { ok: true as const };
});
