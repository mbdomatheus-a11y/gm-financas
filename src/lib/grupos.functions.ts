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

/** Quem está no meu grupo compartilhado (além de mim) e se eu posso revogar acessos. */
export const listarMembrosMeuGrupo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: eu } = await db.from("profiles").select("grupo_id").eq("id", context.userId).single();
    if (!eu?.grupo_id) return { souDono: false, membros: [] as { id: string; nome: string; email: string | null; ehDono: boolean }[] };
    const { data: grupo } = await db.from("grupos").select("criado_por").eq("id", eu.grupo_id).single();
    const { data: membros } = await db
      .from("profiles")
      .select("id,nome,email")
      .eq("grupo_id", eu.grupo_id)
      .eq("ativo", true);
    return {
      souDono: grupo?.criado_por === context.userId,
      membros: ((membros ?? []) as any[])
        .filter((m) => m.id !== context.userId)
        .map((m) => ({
          id: m.id as string,
          nome: m.nome as string,
          email: (m.email as string | null) ?? null,
          ehDono: m.id === grupo?.criado_por,
        })),
    };
  });

/**
 * Revoga o acesso de um integrante ao grupo: ele volta para um grupo próprio,
 * novo e vazio, e deixa de ver os dados do grupo. Os dados já lançados
 * continuam com o grupo original. Pode fazer: o dono do grupo ou o admin do site.
 */
export const revogarAcessoMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ userId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: alvo } = await db
      .from("profiles")
      .select("id,nome,grupo_id")
      .eq("id", data.userId)
      .single();
    if (!alvo?.grupo_id) throw new Error("Usuário não encontrado.");
    const { data: grupo } = await db.from("grupos").select("criado_por").eq("id", alvo.grupo_id).single();
    if (grupo?.criado_por === alvo.id) throw new Error("O dono do grupo não pode ser removido dele.");
    const { data: adm } = await db.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!adm && grupo?.criado_por !== context.userId) {
      throw new Error("Só o dono do grupo ou o administrador do site pode revogar acessos.");
    }
    const { data: novo, error: e1 } = await db
      .from("grupos")
      .insert({ nome: `Grupo de ${alvo.nome}`.slice(0, 80), criado_por: alvo.id })
      .select("id")
      .single();
    if (e1 || !novo) throw new Error("Não foi possível criar o novo grupo do usuário.");
    const { error: e2 } = await db.from("profiles").update({ grupo_id: novo.id }).eq("id", alvo.id);
    if (e2) throw new Error("Não foi possível revogar o acesso.");
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "acesso_grupo_revogado",
      detalhes: { usuario_id: alvo.id, grupo_origem: alvo.grupo_id, grupo_novo: novo.id },
    });
    return { ok: true as const };
  });
