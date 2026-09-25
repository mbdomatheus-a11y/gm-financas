import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
async function admin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}
export const adminListarLayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("layout_solicitacoes")
      .select(
        "id,user_id,banco_informado,cartao_final,arquivo_nome,status,resposta_admin,criado_em,profiles:user_id(nome,email)",
      )
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const adminObterLayoutUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: item, error } = await db
      .from("layout_solicitacoes")
      .select("arquivo_path,status,prazo_exclusao")
      .eq("id", data.id)
      .single();
    if (error || !item) throw new Error("Solicitação não encontrada.");
    if (item.status === "descartada" || new Date(item.prazo_exclusao).getTime() <= Date.now())
      throw new Error("O arquivo já passou do prazo de análise.");
    const { data: link, error: linkError } = await db.storage
      .from("layouts_analise")
      .createSignedUrl(item.arquivo_path, 60);
    if (linkError) throw new Error("Arquivo indisponível para análise.");
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "layout_aberto",
      detalhes: { solicitacao_id: data.id },
    });
    return { url: link.signedUrl as string };
  });
export const adminAtualizarLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["recebida", "em_modelagem", "corrigida", "descartada"]),
        resposta: z.string().trim().max(1000).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: item, error: buscarErro } = await db
      .from("layout_solicitacoes")
      .select("user_id,arquivo_path,arquivo_nome")
      .eq("id", data.id)
      .single();
    if (buscarErro || !item) throw new Error("Solicitação não encontrada.");
    if (data.status === "corrigida" || data.status === "descartada") {
      if (item.arquivo_path) {
        const { error: removerErro } = await db.storage
          .from("layouts_analise")
          .remove([item.arquivo_path]);
        if (removerErro)
          console.warn("Não foi possível apagar o arquivo do storage, prosseguindo com a atualização.");
      }
    }
    const msgConcluido =
      "Arquivo modelado e apagado, em breve uma nova versão estará disponível com sua fatura modelada para importação. Fatura modelada, realize novo teste de importação!";
    const { error } = await db
      .from("layout_solicitacoes")
      .update({
        status: data.status,
        resposta_admin:
          data.resposta || (data.status === "corrigida" ? msgConcluido : null),
        tratado_por: context.userId,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "corrigida")
      await db.from("notificacoes_usuario").insert({
        user_id: item.user_id,
        tipo: "layout_corrigido",
        titulo: "Fatura modelada!",
        mensagem:
          data.resposta || msgConcluido,
        referencia_tipo: "layout",
      });
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "layout_atualizado",
      alvo_id: item.user_id,
      detalhes: { status: data.status, arquivo_descartado: data.status !== "em_modelagem" && data.status !== "recebida" },
    });
    return { ok: true as const };
  });
export const adminCriarComunicado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        titulo: z.string().trim().min(3).max(120),
        mensagem: z.string().trim().min(3).max(2000),
        exigeAceite: z.boolean(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: item, error } = await db
      .from("comunicados")
      .insert({
        criado_por: context.userId,
        titulo: data.titulo,
        mensagem: data.mensagem,
        exige_aceite: data.exigeAceite,
        expira_em: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "comunicado_publicado",
      alvo_id: item.id,
      detalhes: { exige_aceite: data.exigeAceite },
    });
    return { ok: true as const };
  });
export const adminListarComunicados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("comunicados")
      .select("id,titulo,mensagem,ativo,criado_em,expira_em")
      .order("criado_em", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const adminEncerrarComunicado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("comunicados")
      .update({ ativo: false, expira_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "comunicado_encerrado",
      alvo_id: data.id,
      detalhes: {},
    });
    return { ok: true as const };
  });
export const adminMetricas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [
      { count: total },
      { count: ativos },
      { data: perfis, error: perfisErro },
      { data: sessoes, error: sessoesErro },
      { data: usoArquivos, error: usoErro },
    ] = await Promise.all([
      db.from("profiles").select("*", { count: "exact", head: true }),
      db.from("profiles").select("*", { count: "exact", head: true }).eq("ativo", true),
      db
        .from("profiles")
        .select("id,nome,email,ativo,grupo_id,grupos:grupo_id(nome)")
        .order("created_at", { ascending: false })
        .limit(1000),
      db
        .from("eventos_sessao")
        .select("user_id,iniciou_em,ultima_atividade_em,encerrou_em")
        .order("ultima_atividade_em", { ascending: false })
        .limit(5000),
      db.from("admin_uso_arquivos").select("user_id,arquivos,bytes"),
    ]);
    if (perfisErro || sessoesErro || usoErro)
      throw new Error("Não foi possível carregar os indicadores.");
    const usoPorUsuario = new Map<string, { arquivos: number; bytes: number }>();
    for (const uso of usoArquivos ?? []) {
      if (uso.user_id)
        usoPorUsuario.set(uso.user_id, {
          arquivos: Number(uso.arquivos),
          bytes: Number(uso.bytes),
        });
    }
    const ultimaPorUsuario = new Map<string, string>();
    for (const sessao of sessoes ?? []) {
      if (!ultimaPorUsuario.has(sessao.user_id)) {
        ultimaPorUsuario.set(sessao.user_id, sessao.ultima_atividade_em);
      }
    }
    const duracoes = (sessoes ?? [])
      .map(
        (s: any) =>
          new Date(s.encerrou_em ?? s.ultima_atividade_em).getTime() -
          new Date(s.iniciou_em).getTime(),
      )
      .filter((n: number) => n >= 0 && n <= 24 * 60 * 60 * 1000);
    return {
      total: total ?? 0,
      ativos: ativos ?? 0,
      tempoMedioMin: duracoes.length
        ? Math.round(duracoes.reduce((a: number, b: number) => a + b, 0) / duracoes.length / 60000)
        : 0,
      usuarios: (perfis ?? []).map((perfil: any) => ({
        id: perfil.id as string,
        nome: perfil.nome as string,
        email: perfil.email as string | null,
        ativo: perfil.ativo as boolean,
        ultimaAtividadeEm: ultimaPorUsuario.get(perfil.id) ?? null,
        arquivos: usoPorUsuario.get(perfil.id)?.arquivos ?? 0,
        bytesArmazenados: usoPorUsuario.get(perfil.id)?.bytes ?? 0,
        grupoId: perfil.grupo_id ?? null,
        grupoNome: perfil.grupos?.nome ?? "Sem grupo",
      })),
      armazenamentoNaoAtribuidoBytes: Number(
        (usoArquivos ?? []).find((uso: any) => !uso.user_id)?.bytes ?? 0,
      ),
      grupos: [
        ...new Map(
          (perfis ?? [])
            .filter((p: any) => p.grupo_id)
            .map((p: any) => [
              p.grupo_id,
              { id: p.grupo_id, nome: p.grupos?.nome ?? "Grupo", membros: [] },
            ]),
        ).values(),
      ].map((g: any) => ({
        ...g,
        membros: (perfis ?? [])
          .filter((p: any) => p.grupo_id === g.id)
          .map((p: any) => ({ id: p.id, nome: p.nome, email: p.email, ativo: p.ativo })),
      })),
    };
  });
export const adminListarLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("admin_audit_logs")
      .select("id,acao,alvo_id,detalhes,criado_em,ator_id")
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((item: any) => item.ator_id).filter(Boolean))];
    const { data: perfis } = ids.length
      ? await db.from("profiles").select("id,nome,email").in("id", ids)
      : { data: [] };
    const porId = new Map((perfis ?? []).map((perfil: any) => [perfil.id, perfil]));
    return (data ?? []).map((item: any) => ({
      ...item,
      profiles: porId.get(item.ator_id) ?? null,
    }));
  });
