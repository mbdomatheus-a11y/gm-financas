import { createFileRoute } from "@tanstack/react-router";

/**
 * Marca como pagas as parcelas vencidas há 30+ dias, para cada grupo que
 * escolheu o modo automático de conciliação de faturas (item 12 do
 * backlog). O prazo de 30 dias é aplicado por parcela (vencimento + 30
 * dias), e só entram parcelas com vencimento a partir da data em que o
 * grupo ativou o modo automático — dívida vencida antes da ativação nunca
 * é marcada como paga por este job, só manualmente pelo usuário.
 */
async function conciliarFaturasAutomaticas(db: any): Promise<number> {
  const { data: gruposAutomaticos, error: configError } = await db
    .from("configuracoes_casal")
    .select("grupo_id,updated_at")
    .eq("valor", "automatico")
    .like("chave", "%:conciliacao_faturas_modo");
  if (configError || !gruposAutomaticos?.length) return 0;

  const hoje = new Date();
  const limiteVencimento = new Date(hoje);
  limiteVencimento.setDate(limiteVencimento.getDate() - 30);
  const limiteISO = limiteVencimento.toISOString().slice(0, 10);

  let conciliadas = 0;
  for (const grupo of gruposAutomaticos) {
    const ativadoEmISO = new Date(grupo.updated_at).toISOString().slice(0, 10);
    const { data: parcelasElegiveis, error: parcelasError } = await db
      .from("parcelas")
      .select("id,vencimento")
      .eq("grupo_id", grupo.grupo_id)
      .eq("paga", false)
      .lte("vencimento", limiteISO)
      .gte("vencimento", ativadoEmISO)
      .limit(500);
    if (parcelasError) continue;
    for (const parcela of parcelasElegiveis ?? []) {
      const dataPagamento = new Date(parcela.vencimento);
      dataPagamento.setDate(dataPagamento.getDate() + 30);
      const { error: updateError } = await db
        .from("parcelas")
        .update({ paga: true, data_pagamento: dataPagamento.toISOString().slice(0, 10) })
        .eq("id", parcela.id)
        .eq("paga", false); // reconfirma pra não sobrescrever se alguém pagou manualmente nesse meio-tempo
      if (!updateError) conciliadas++;
    }
    if ((parcelasElegiveis?.length ?? 0) > 0) {
      await db.from("admin_audit_logs").insert({
        acao: "faturas_conciliadas_automaticamente",
        detalhes: { grupo_id: grupo.grupo_id, quantidade: parcelasElegiveis?.length ?? 0 },
      });
    }
  }
  return conciliadas;
}

/**
 * Item 15 do backlog (revisão de segurança, 2026-09-26): a tabela genérica
 * de limite de tentativas (`rate_limit_eventos`) só precisa guardar a
 * última hora de eventos pra funcionar — sem limpeza ela cresceria pra
 * sempre. Aproveita este mesmo cron diário em vez de criar outro na Vercel.
 */
async function limparRateLimitAntigo(db: any): Promise<number> {
  const limite = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data, error } = await db
    .from("rate_limit_eventos")
    .delete()
    .lt("criado_em", limite)
    .select("id");
  if (error) return 0;
  return data?.length ?? 0;
}

export const Route = createFileRoute("/api/cron/descarte-layouts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Não autorizado", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data: vencidos, error } = await db
          .from("layout_solicitacoes")
          .select("id,user_id,arquivo_path")
          .lte("prazo_exclusao", new Date().toISOString())
          .in("status", ["recebida", "em_modelagem"])
          .limit(100);
        if (error) return new Response("Falha ao consultar a fila", { status: 500 });

        let descartados = 0;
        for (const item of vencidos ?? []) {
          const { error: arquivoError } = await db.storage
            .from("layouts_analise")
            .remove([item.arquivo_path]);
          if (arquivoError) continue;
          const { error: registroError } = await db
            .from("layout_solicitacoes")
            .update({ status: "descartada", atualizado_em: new Date().toISOString() })
            .eq("id", item.id);
          if (registroError) continue;
          await db.from("admin_audit_logs").insert({
            acao: "layout_descartado_por_prazo",
            alvo_id: item.user_id,
            detalhes: { solicitacao_id: item.id },
          });
          descartados++;
        }

        // Item 12 do backlog: grupos que ativaram a conciliação automática
        // de faturas (configurações > conciliação de faturas) têm parcelas
        // vencidas há mais de 30 dias marcadas como pagas automaticamente.
        // Só afeta parcelas com vencimento a partir de quando o modo foi
        // ativado (não retroage sobre dívida que já existia antes disso).
        const conciliadas = await conciliarFaturasAutomaticas(db);
        const rateLimitLimpo = await limparRateLimitAntigo(db);

        return Response.json({ descartados, conciliadas, rateLimitLimpo });
      },
    },
  },
});
