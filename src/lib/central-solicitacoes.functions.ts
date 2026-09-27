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
      // Item 13: layout_solicitacoes também gera protocolo — inclui aqui
      // pra consulta pública funcionar pros três tipos de solicitação.
      const { data: layout } = await db
        .from("layout_solicitacoes")
        .select("protocolo,status,arquivo_nome,criado_em,atualizado_em,resposta_admin")
        .eq("protocolo", data.protocolo)
        .maybeSingle();
      if (layout) {
        const dias = Math.floor((Date.now() - new Date(layout.criado_em).getTime()) / 86400000);
        return { tipo: "layout" as const, protocolo: layout.protocolo, status: layout.status, tipo_solicitacao: layout.arquivo_nome, dias_aberto: dias, atualizado_em: layout.atualizado_em, resposta: layout.resposta_admin };
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

// Item 12: anexo opcional (imagem ou PDF) na abertura do chamado, ao
// complementar, ou na resposta do admin. Validação de tipo/tamanho aqui é a
// primeira camada; o bucket "anexos" no Supabase Storage tem os mesmos
// limites configurados (20MB, mesma lista de mime types) como segunda
// camada independente. Varredura antivírus é trabalho futuro — combinado
// com o usuário que, por ora, apenas tipo/tamanho são validados.
const TIPOS_ANEXO_PERMITIDOS = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const TAMANHO_MAXIMO_ANEXO = 20 * 1024 * 1024; // 20MB

const anexoSchema = z.object({
  path: z.string().min(1),
  nome: z.string().min(1).max(180),
  tipo: z.string().min(1).max(100),
});

export const criarUploadAnexoChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      nomeArquivo: z.string().min(1).max(180),
      tipoMime: z.string().min(1).max(100),
      tamanhoBytes: z.number().int().positive(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    if (!TIPOS_ANEXO_PERMITIDOS.has(data.tipoMime)) {
      throw new Error("Tipo de arquivo não permitido. Envie apenas imagem (JPG, PNG, WEBP) ou PDF.");
    }
    if (data.tamanhoBytes > TAMANHO_MAXIMO_ANEXO) {
      throw new Error("Arquivo muito grande. O limite é 20MB.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const nomeSeguro = data.nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `chamados/${context.userId}/${crypto.randomUUID()}-${nomeSeguro}`;
    const { data: url, error } = await db.storage.from("anexos").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: url.token as string, nome: data.nomeArquivo, tipo: data.tipoMime };
  });

export const enviarChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      assunto: z.string().trim().min(5).max(120),
      descricao: z.string().trim().min(10).max(3000),
      prioridade: z.enum(["elogio","reclamacao","sugestao"]).optional(),
      anexo: anexoSchema.optional(),
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
        anexo_path: data.anexo?.path ?? null,
        anexo_nome: data.anexo?.nome ?? null,
        anexo_tipo: data.anexo?.tipo ?? null,
      })
      .select("protocolo")
      .single();
    if (error) throw new Error(error.message);
    // Item 8: e-mail pro admin com o conteúdo integral (não só o protocolo)
    // e um botão que leva direto pra aba de tratamento no site; e-mail de
    // cópia + link de acompanhamento pro usuário que abriu o chamado.
    try {
      const { enviarEmail, obterUrlBaseSite } = await import("@/lib/email.server");
      const base = obterUrlBaseSite();
      const PRIORIDADE_LABEL: Record<string, string> = { elogio: "Elogio", reclamacao: "Reclamação", sugestao: "Sugestão" };
      await enviarEmail({
        to: "privacidade@controlall.com.br",
        subject: `Control ALL: novo chamado de suporte — ${data.assunto}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Novo chamado de suporte</h2>
            <p><b>Protocolo:</b> ${chamado.protocolo}</p>
            <p><b>Usuário:</b> ${perfil?.nome ?? "N/D"} (${perfil?.email ?? "N/D"})</p>
            <p><b>Tipo:</b> ${PRIORIDADE_LABEL[data.prioridade ?? "sugestao"]}</p>
            <p><b>Assunto:</b> ${data.assunto}</p>
            <p><b>Descrição:</b><br>${data.descricao.replace(/\n/g, "<br>")}</p>
            ${data.anexo ? `<p><b>Anexo:</b> ${data.anexo.nome}</p>` : ""}
            <p style="margin-top: 20px;">
              <a href="${base}/administracao?aba=central" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Tratar chamado</a>
            </p>
          </div>
        `,
      });
      if (perfil?.email) {
        await enviarEmail({
          to: perfil.email,
          subject: `Control ALL: recebemos seu chamado de suporte`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <p>Olá${perfil?.nome ? `, ${perfil.nome}` : ""},</p>
              <p>Recebemos seu chamado. Cópia da sua solicitação:</p>
              <p><b>Assunto:</b> ${data.assunto}</p>
              <p><b>Descrição:</b><br>${data.descricao.replace(/\n/g, "<br>")}</p>
              <p><b>Protocolo:</b> ${chamado.protocolo}</p>
              <p style="margin-top: 16px;">
                Acompanhe pelo link: <a href="${base}/consultar-protocolo?p=${chamado.protocolo}">${base}/consultar-protocolo?p=${chamado.protocolo}</a>
              </p>
              <p>Equipe Control ALL</p>
            </div>
          `,
        });
      }
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
      .select("id,protocolo,email,nome,assunto,descricao,status,prioridade,resposta_admin,anexo_path,anexo_nome,anexo_tipo,criado_em,atualizado_em")
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
      anexo: anexoSchema.optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: chamado } = await db
      .from("chamados_suporte")
      .select("email,assunto,status,protocolo")
      .eq("id", data.id)
      .single();
    // Item 9 (parte 2): um chamado cancelado (pelo usuário ou pelo próprio
    // admin) nunca é excluído de fato — continua visível na lista do admin —
    // mas não aceita mais nenhuma resposta/atualização a partir daí.
    if (chamado?.status === "cancelado") {
      throw new Error("Este chamado foi cancelado e não aceita mais respostas.");
    }
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
    // Item 12: toda resposta do admin (com ou sem anexo) entra na mesma
    // thread de mensagens usada pelos complementos do usuário, formando um
    // histórico único visível para os dois lados.
    if (data.resposta || data.anexo) {
      await db.from("chamados_suporte_mensagens").insert({
        chamado_id: data.id,
        autor_tipo: "admin",
        autor_id: context.userId,
        mensagem: data.resposta ?? null,
        anexo_path: data.anexo?.path ?? null,
        anexo_nome: data.anexo?.nome ?? null,
        anexo_tipo: data.anexo?.tipo ?? null,
      });
    }
    if (data.resposta && chamado?.email) {
      try {
        const { enviarEmail, obterUrlBaseSite } = await import("@/lib/email.server");
        const base = obterUrlBaseSite();
        await enviarEmail({
          to: chamado.email,
          subject: `Control ALL: seu chamado de suporte foi atualizado`,
          html: `<p>Olá,</p><p>Seu chamado "<strong>${chamado.assunto}</strong>" foi atualizado.<br>Resposta: ${data.resposta}</p><p>Acompanhe pelo link: <a href="${base}/consultar-protocolo?p=${chamado.protocolo}">${base}/consultar-protocolo?p=${chamado.protocolo}</a></p><p>Equipe Control ALL</p>`,
        });
      } catch { /* não crítico */ }
    }
    return { ok: true as const };
  });

// Item 9 (parte 2): o usuário pode cancelar um chamado que ele mesmo abriu.
// Nunca exclui a linha de fato — apenas marca status "cancelado", que
// continua visível na lista do admin (histórico/auditoria) mas passa a
// bloquear qualquer resposta futura (ver `adminAtualizarChamado` acima).
export const cancelarChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: chamado, error: buscarError } = await db
      .from("chamados_suporte")
      .select("user_id,status")
      .eq("id", data.id)
      .single();
    if (buscarError || !chamado) throw new Error("Chamado não encontrado.");
    if (chamado.user_id !== context.userId) {
      throw new Error("Você só pode cancelar chamados que você mesmo abriu.");
    }
    if (chamado.status === "cancelado") {
      return { ok: true as const };
    }

    const { error } = await db
      .from("chamados_suporte")
      .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Item 12: usuário complementa um chamado já aberto (texto e/ou anexo) sem
// que isso crie um novo chamado — vira uma mensagem na mesma thread que as
// respostas do admin. Se o chamado já estava "resolvido" ou "aguardando
// sua resposta", volta para "recebido" para sinalizar ao admin que precisa
// olhar de novo.
export const complementarChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      chamadoId: z.string().uuid(),
      mensagem: z.string().trim().min(1).max(2000).optional(),
      anexo: anexoSchema.optional(),
    })
      .refine((d) => d.mensagem || d.anexo, { message: "Escreva uma mensagem ou anexe um arquivo." })
      .parse(v)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: chamado, error: buscarError } = await db
      .from("chamados_suporte")
      .select("user_id,status")
      .eq("id", data.chamadoId)
      .single();
    if (buscarError || !chamado) throw new Error("Chamado não encontrado.");
    if (chamado.user_id !== context.userId) {
      throw new Error("Você só pode complementar chamados que você mesmo abriu.");
    }
    if (chamado.status === "cancelado") {
      throw new Error("Este chamado foi cancelado e não aceita mais complementos.");
    }

    const { error } = await db.from("chamados_suporte_mensagens").insert({
      chamado_id: data.chamadoId,
      autor_tipo: "usuario",
      autor_id: context.userId,
      mensagem: data.mensagem ?? null,
      anexo_path: data.anexo?.path ?? null,
      anexo_nome: data.anexo?.nome ?? null,
      anexo_tipo: data.anexo?.tipo ?? null,
    });
    if (error) throw new Error(error.message);

    if (chamado.status === "resolvido" || chamado.status === "aguardando_usuario") {
      await db
        .from("chamados_suporte")
        .update({ status: "recebido", atualizado_em: new Date().toISOString() })
        .eq("id", data.chamadoId);
    }

    return { ok: true as const };
  });

// Lista a thread de complementos/respostas de um chamado (dono do chamado
// ou admin do site podem ver).
export const listarMensagensChamado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ chamadoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: chamado } = await db
      .from("chamados_suporte")
      .select("user_id")
      .eq("id", data.chamadoId)
      .single();
    if (!chamado) throw new Error("Chamado não encontrado.");
    let podeVer = chamado.user_id === context.userId;
    if (!podeVer) {
      const { data: admin } = await db
        .from("site_admins")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle();
      podeVer = !!admin;
    }
    if (!podeVer) throw new Error("Acesso não autorizado a este chamado.");

    const { data: mensagens, error } = await db
      .from("chamados_suporte_mensagens")
      .select("id,autor_tipo,mensagem,anexo_path,anexo_nome,anexo_tipo,criado_em")
      .eq("chamado_id", data.chamadoId)
      .order("criado_em", { ascending: true });
    if (error) throw new Error(error.message);
    return mensagens ?? [];
  });

// Gera uma URL assinada (5 min) para abrir um anexo — confere que quem pede
// pode ver o chamado E que o path pertence de fato a ele (anexo inicial ou
// de uma mensagem da thread), evitando que alguém tente adivinhar paths de
// anexos de outros chamados.
export const obterUrlAnexoChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ chamadoId: z.string().uuid(), path: z.string().min(1) }).parse(v)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: chamado } = await db
      .from("chamados_suporte")
      .select("user_id,anexo_path")
      .eq("id", data.chamadoId)
      .single();
    if (!chamado) throw new Error("Chamado não encontrado.");

    let podeVer = chamado.user_id === context.userId;
    if (!podeVer) {
      const { data: admin } = await db
        .from("site_admins")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle();
      podeVer = !!admin;
    }
    if (!podeVer) throw new Error("Acesso não autorizado a este anexo.");

    let pathValido = chamado.anexo_path === data.path;
    if (!pathValido) {
      const { data: msg } = await db
        .from("chamados_suporte_mensagens")
        .select("id")
        .eq("chamado_id", data.chamadoId)
        .eq("anexo_path", data.path)
        .maybeSingle();
      pathValido = !!msg;
    }
    if (!pathValido) throw new Error("Anexo não pertence a este chamado.");

    const { data: signed, error } = await db.storage.from("anexos").createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl as string };
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
