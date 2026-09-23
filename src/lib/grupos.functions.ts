import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");

export const convidarParaMeuGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ email: z.string().trim().email() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: perfil } = await db
      .from("profiles")
      .select("grupo_id,nome")
      .eq("id", context.userId)
      .single();
    if (!perfil?.grupo_id) throw new Error("Seu grupo não foi localizado.");
    const { data: destino } = await db
      .from("profiles")
      .select("id")
      .ilike("email", data.email)
      .eq("ativo", true)
      .maybeSingle();
    if (!destino) throw new Error("O destinatário precisa ter uma conta ativa no Control ALL.");
    const token = randomBytes(32).toString("hex");
    const { error } = await db.from("convites_grupo").insert({
      grupo_id: perfil.grupo_id,
      criado_por: context.userId,
      email_destino: data.email.toLowerCase(),
      token_hash: hash(token),
    });
    if (error) throw new Error(error.message);
    const { enviarEmail } = await import("@/lib/email.server");
    const link = `${process.env["SITE_URL"] || "https://www.controlall.com.br"}/conta?conviteGrupo=${token}`;
    const enviado = await enviarEmail({
      to: data.email,
      subject: "Convite para compartilhar um workspace no Control ALL",
      html: `<p>${perfil.nome} convidou você para compartilhar o mesmo workspace no Control ALL.</p><p>Ao aceitar, todos do grupo verão o mesmo conjunto de finanças, listas, notas e demais dados compartilhados. Seus dados do grupo individual serão transferidos para o workspace integrado.</p><p><a href="${link}">Revisar e aceitar convite</a></p><p>O convite vale por 7 dias.</p>`,
    });
    if (!enviado.ok) throw new Error("O convite foi criado, mas o e-mail não pôde ser enviado.");
    return { ok: true as const };
  });

export const aceitarConviteGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ token: z.string().min(40) }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: grupo, error } = await (context.supabase as any).rpc("aceitar_convite_grupo", {
      p_token: data.token,
    });
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "convite_grupo_aceito",
      detalhes: { grupo_id: grupo },
    });
    return { ok: true as const };
  });
