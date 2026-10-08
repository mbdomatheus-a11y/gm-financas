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
    const emailAlvo = data.email.trim().toLowerCase();
    // Escapa curingas do ilike (% e _) para casar o e-mail literalmente.
    const padrao = emailAlvo.replace(/[\\%_]/g, (c) => `\\${c}`);
    let { data: destino } = await db
      .from("profiles")
      .select("id")
      .ilike("email", padrao)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (!destino) {
      // Perfis antigos podem estar sem e-mail preenchido: confere direto na autenticação.
      const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const achado = lista?.users.find((u) => u.email?.toLowerCase() === emailAlvo);
      if (achado) {
        const { data: perfilAchado } = await db
          .from("profiles")
          .select("id")
          .eq("id", achado.id)
          .eq("ativo", true)
          .maybeSingle();
        destino = perfilAchado;
      }
    }
    if (!destino) throw new Error("O destinatário precisa ter uma conta ativa no Control ALL.");
    if (destino.id === context.userId) throw new Error("Você não pode convidar a si mesmo.");
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
      html: `<p>${perfil.nome} convidou você para compartilhar o mesmo workspace no Control ALL.</p><p>Ao aceitar, todos do grupo verão o mesmo conjunto de finanças, listas, notas e demais dados compartilhados. Seu workspace atual fica guardado em segurança, sem alterações, e volta a ser seu caso você saia do grupo.</p><p><a href="${link}">Revisar e aceitar convite</a></p><p>O convite vale por 7 dias.</p>`,
    });
    if (!enviado.ok) {
      // O convite existe; devolve o link ao dono para enviar por outro canal (ex.: WhatsApp).
      console.error("[convite-grupo] e-mail não enviado:", enviado.erro);
      return { ok: true as const, emailEnviado: false as const, link };
    }
    return { ok: true as const, emailEnviado: true as const, link: null };
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
      .select("id,nome,grupo_id,grupo_secundario_id")
      .eq("id", data.userId)
      .single();
    if (!alvo?.grupo_id) throw new Error("Usuário não encontrado.");
    const { data: grupo } = await db.from("grupos").select("criado_por").eq("id", alvo.grupo_id).single();
    if (grupo?.criado_por === alvo.id) throw new Error("O dono do grupo não pode ser removido dele.");
    const { data: adm } = await db.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!adm && grupo?.criado_por !== context.userId) {
      throw new Error("Só o dono do grupo ou o administrador do site pode revogar acessos.");
    }
    let destinoId: string | null = alvo.grupo_secundario_id ?? null;
    if (!destinoId) {
      const { data: novo, error: e1 } = await db
        .from("grupos")
        .insert({ nome: `Grupo de ${alvo.nome}`.slice(0, 80), criado_por: alvo.id })
        .select("id")
        .single();
      if (e1 || !novo) throw new Error("Não foi possível criar o novo grupo do usuário.");
      destinoId = novo.id as string;
    }
    // Volta ao workspace original guardado (backup) ou, se não houver, a um novo vazio.
    const { error: e2 } = await db.rpc("revogar_membro_grupo", { p_user: alvo.id, p_destino: destinoId });
    if (e2) throw new Error("Não foi possível revogar o acesso.");
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "acesso_grupo_revogado",
      detalhes: { usuario_id: alvo.id, grupo_origem: alvo.grupo_id, grupo_restaurado: destinoId },
    });
    return { ok: true as const };
  });

/** Convites pendentes endereçados ao e-mail do usuário logado (notificação in-app). */
export const meusConvitesRecebidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return [] as { id: string; de: string; status: string; expiraEm: string; criadoEm: string }[];
    const { data } = await db
      .from("convites_grupo")
      .select("id,status,expira_em,criado_em,criado_por")
      .ilike("email_destino", email.replace(/[\\%_]/g, (c) => `\\${c}`))
      .order("criado_em", { ascending: false })
      .limit(30);
    const ids = [...new Set(((data ?? []) as any[]).map((c) => c.criado_por))];
    const { data: nomes } = ids.length
      ? await db.from("profiles").select("id,nome").in("id", ids)
      : { data: [] };
    const mapa = new Map(((nomes ?? []) as any[]).map((n) => [n.id, n.nome as string]));
    return ((data ?? []) as any[]).map((c) => ({
      id: c.id as string,
      de: mapa.get(c.criado_por) ?? "Alguém",
      status: (c.status === "pendente" && new Date(c.expira_em) < new Date() ? "expirado" : c.status) as string,
      expiraEm: c.expira_em as string,
      criadoEm: c.criado_em as string,
    }));
  });

/** Convites que eu enviei (histórico: pendente, aceito, recusado, revogado, expirado). */
export const meusConvitesEnviados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("convites_grupo")
      .select("id,email_destino,status,expira_em,criado_em")
      .eq("criado_por", context.userId)
      .order("criado_em", { ascending: false })
      .limit(50);
    return ((data ?? []) as any[]).map((c) => ({
      id: c.id as string,
      email: c.email_destino as string,
      status: (c.status === "pendente" && new Date(c.expira_em) < new Date() ? "expirado" : c.status) as string,
      criadoEm: c.criado_em as string,
    }));
  });

export const aceitarConviteGrupoPorId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: grupo, error } = await (context.supabase as any).rpc("aceitar_convite_grupo_id", {
      p_convite_id: data.id,
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

export const recusarConviteGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("recusar_convite_grupo", { p_convite_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Sai do grupo atual e volta ao workspace original, que estava guardado intacto. */
export const sairDoGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as any).rpc("sair_do_grupo");
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "saiu_do_grupo",
      detalhes: {},
    });
    return { ok: true as const };
  });

/** Se estou em grupo de outra pessoa (workspace original guardado). */
export const meuStatusGrupo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("profiles")
      .select("grupo_secundario_id")
      .eq("id", context.userId)
      .single();
    return { emGrupoDeOutro: !!data?.grupo_secundario_id };
  });

/** Exclui definitivamente o registro de um convite do histórico (não mexe em dados nem em acesso). */
export const excluirConviteGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: c } = await db.from("convites_grupo").select("criado_por,email_destino").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Convite não encontrado.");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const souDestino = u?.user?.email?.toLowerCase() === String(c.email_destino).toLowerCase();
    if (c.criado_por !== context.userId && !souDestino) throw new Error("Sem permissão.");
    const { error } = await db.from("convites_grupo").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
