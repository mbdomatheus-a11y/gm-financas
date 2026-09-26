import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

// ─── Solicitações de Privacidade ───────────────────────────────────────────

export const adminListarSolicitacoesPrivacidade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("solicitacoes_privacidade")
      .select("id,protocolo,email,telefone,tipo,motivo,status,resposta_admin,tratativa_historico,criado_em,atualizado_em")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminTratarSolicitacaoPrivacidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["recebida","em_analise","concluida","indeferida","em_atendimento","aguardando_ti","planejado","programado"]),
      resposta: z.string().trim().max(2000).optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // Buscar tratativa atual para appender no histórico
    const { data: atual } = await db
      .from("solicitacoes_privacidade")
      .select("tratativa_historico,email")
      .eq("id", data.id)
      .single();
    const historico = Array.isArray(atual?.tratativa_historico) ? atual.tratativa_historico : [];
    if (data.resposta) {
      historico.push({
        data: new Date().toISOString(),
        admin_id: context.userId,
        status: data.status,
        mensagem: data.resposta,
      });
    }
    const { error } = await db
      .from("solicitacoes_privacidade")
      .update({
        status: data.status,
        resposta_admin: data.resposta ?? null,
        tratativa_historico: historico,
        tratado_por: context.userId,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Notificar solicitante por e-mail se houver resposta
    if (data.resposta && atual?.email) {
      try {
        const { enviarEmail } = await import("@/lib/email.server");
        const statusLabel: Record<string, string> = {
          recebida: "Recebida",
          em_analise: "Em Análise",
          concluida: "Concluída",
          indeferida: "Indeferida",
          em_atendimento: "Em Atendimento",
          aguardando_ti: "Aguardando TI",
          planejado: "Planejado",
          programado: "Programado",
        };
        await enviarEmail({
          to: atual.email,
          subject: `Control ALL: atualização da sua solicitação de privacidade`,
          html: `<p>Olá,</p><p>Sua solicitação foi atualizada para: <strong>${statusLabel[data.status] ?? data.status}</strong>.</p><p>Tratativa: ${data.resposta}</p><p>Equipe Control ALL</p>`,
        });
      } catch { /* e-mail não-crítico */ }
    }
    return { ok: true as const };
  });

// Consulta pública de protocolo (sem auth) — para Home
// Item 15 do backlog (revisão de segurança, 2026-09-26): esta rota é
// pública e a busca por CPF não exige prova de posse do documento — sem
// limite de tentativas, seria possível varrer CPFs (bruteforce) pra
// descobrir quem tem solicitações abertas e ler a resposta do admin.
// Agora limitada por IP (`aplicarLimitePorIp`) antes de qualquer consulta.
export const consultarProtocolo = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z.object({
      protocolo: z.string().uuid("Protocolo inválido").optional(),
      cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos").optional(),
    }).refine((d) => d.protocolo || d.cpf, { message: "Informe um protocolo ou CPF." }).parse(v)
  )
  .handler(async ({ data }) => {
    const { createHash } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { aplicarLimitePorIp } = await import("@/lib/rate-limit.server");
    const db = supabaseAdmin as any;
    await aplicarLimitePorIp(db, "consultar-protocolo", 20, 60);

    if (data.protocolo) {
      // Busca por protocolo UUID
      const { data: priv } = await db
        .from("solicitacoes_privacidade")
        .select("protocolo,status,tipo,criado_em,atualizado_em,resposta_admin")
        .eq("protocolo", data.protocolo)
        .maybeSingle();
      if (priv) {
        const dias = Math.floor((Date.now() - new Date(priv.criado_em).getTime()) / 86400000);
        return { tipo: "privacidade" as const, protocolo: priv.protocolo, status: priv.status, tipo_solicitacao: priv.tipo, dias_aberto: dias, atualizado_em: priv.atualizado_em, resposta: priv.resposta_admin };
      }
      const { data: chamado } = await db
        .from("chamados_suporte")
        .select("protocolo,status,assunto,criado_em,atualizado_em,resposta_admin")
        .eq("protocolo", data.protocolo)
        .maybeSingle();
      if (chamado) {
        const dias = Math.floor((Date.now() - new Date(chamado.criado_em).getTime()) / 86400000);
        return { tipo: "suporte" as const, protocolo: chamado.protocolo, status: chamado.status, tipo_solicitacao: chamado.assunto, dias_aberto: dias, atualizado_em: chamado.atualizado_em, resposta: chamado.resposta_admin };
      }
      return null;
    }

    if (data.cpf) {
      // Busca por CPF hash em solicitações de privacidade
      const cpfHash = createHash("sha256").update(data.cpf).digest("hex");
      const { data: privs } = await db
        .from("solicitacoes_privacidade")
        .select("protocolo,status,tipo,criado_em,atualizado_em,resposta_admin")
        .eq("cpf_hash", cpfHash)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (privs && privs.length > 0) {
        return (privs as any[]).map((priv: any) => ({
          tipo: "privacidade" as const,
          protocolo: priv.protocolo,
          status: priv.status,
          tipo_solicitacao: priv.tipo,
          dias_aberto: Math.floor((Date.now() - new Date(priv.criado_em).getTime()) / 86400000),
          atualizado_em: priv.atualizado_em,
          resposta: priv.resposta_admin,
        }));
      }
      return null;
    }

    return null;
  });

// ─── Chamados de Suporte ───────────────────────────────────────────────────

export const enviarChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      assunto: z.string().trim().min(5).max(120),
      descricao: z.string().trim().min(10).max(3000),
      prioridade: z.enum(["elogio","reclamacao","sugestao"]).optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: perfil } = await context.supabase
      .from("profiles")
      .select("nome,email,grupo_id")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: chamado, error } = await db
      .from("chamados_suporte")
      .insert({
        user_id: context.userId,
        grupo_id: perfil?.grupo_id ?? null,
        email: perfil?.email ?? "",
        nome: perfil?.nome ?? null,
        assunto: data.assunto,
        descricao: data.descricao,
        prioridade: data.prioridade ?? "sugestao",
      })
      .select("protocolo")
      .single();
    if (error) throw new Error(error.message);
    // Notificar admin
    try {
      const { enviarEmail } = await import("@/lib/email.server");
      await enviarEmail({
        to: "privacidade@controlall.com.br",
        subject: `Control ALL: novo chamado de suporte — ${data.assunto}`,
        html: `<p>Novo chamado de suporte. Protocolo: <strong>${chamado.protocolo}</strong>.</p><p>Assunto: ${data.assunto}</p><p>Usuário: ${perfil?.nome ?? "N/D"} (${perfil?.email ?? "N/D"})</p>`,
      });
    } catch { /* não crítico */ }
    return { protocolo: chamado.protocolo as string };
  });

export const adminListarChamados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("chamados_suporte")
      .select("id,protocolo,email,nome,assunto,descricao,status,prioridade,resposta_admin,criado_em,atualizado_em")
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminAtualizarChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["recebido","em_atendimento","aguardando_usuario","resolvido","cancelado"]),
      resposta: z.string().trim().max(2000).optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: chamado } = await db
      .from("chamados_suporte")
      .select("email,assunto")
      .eq("id", data.id)
      .single();
    const { error } = await db
      .from("chamados_suporte")
      .update({
        status: data.status,
        resposta_admin: data.resposta ?? null,
        tratado_por: context.userId,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.resposta && chamado?.email) {
      try {
        const { enviarEmail } = await import("@/lib/email.server");
        await enviarEmail({
          to: chamado.email,
          subject: `Control ALL: seu chamado de suporte foi atualizado`,
          html: `<p>Olá,</p><p>Seu chamado "<strong>${chamado.assunto}</strong>" foi atualizado.<br>Resposta: ${data.resposta}</p><p>Equipe Control ALL</p>`,
        });
      } catch { /* não crítico */ }
    }
    return { ok: true as const };
  });

// ─── Convites (visão admin) ────────────────────────────────────────────────

export const adminListarConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("convites")
      .select("id,token,usado,cancelado,criado_por,criado_em,expira_em,profiles:criado_por(nome,email)")
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      id: c.id,
      token: c.token,
      status: c.usado ? "usado" : c.cancelado ? "cancelado" : new Date(c.expira_em) < new Date() ? "expirado" : "pendente",
      criador_nome: c.profiles?.nome ?? c.profiles?.email ?? "N/D",
      criado_em: c.criado_em,
      expira_em: c.expira_em,
    }));
  });
