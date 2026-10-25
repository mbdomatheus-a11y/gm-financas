import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * PIX da conta corrente lidos pelo Open Finance (pedido de 24/10/2026).
 * Os PIX ficam numa aba própria em Receitas (recebidos) e em Despesas (enviados) e só viram
 * lançamento quando a pessoa confirma: nova receita/despesa ou substituição de um lançamento do mês.
 * pluggy_transacoes não é lida pelo navegador (RLS sem policies); tudo passa por aqui, sempre
 * limitado às contas do grupo de quem pede.
 */

const DIAS_LISTA = 400;
const CATEGORIAS_PROPRIAS = /^(same person transfer|transfer - internal)/i;

type Contexto = { userId: string; supabase: any };

async function grupoDe(db: any, userId: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("grupo_id").eq("id", userId).maybeSingle();
  return (data?.grupo_id as string | null) ?? null;
}

/** Contas correntes (não cartão) do grupo, com o nome do banco. */
async function contasDoGrupo(db: any, grupoId: string) {
  const { data: contas } = await db
    .from("pluggy_contas")
    .select("account_id, banco_id, nome, tipo")
    .eq("grupo_id", grupoId)
    .neq("tipo", "CREDIT");
  const lista = (contas ?? []) as { account_id: string; banco_id: string | null; nome: string | null }[];
  const bancoIds = [...new Set(lista.map((c) => c.banco_id).filter(Boolean))] as string[];
  const nomes = new Map<string, string>();
  if (bancoIds.length) {
    const { data: bancos } = await db.from("bancos").select("id, nome").in("id", bancoIds);
    for (const b of bancos ?? []) nomes.set(String(b.id), String(b.nome));
  }
  return lista.map((c) => ({
    accountId: c.account_id,
    bancoId: c.banco_id,
    banco: (c.banco_id && nomes.get(c.banco_id)) || c.nome || "Conta",
  }));
}

function ehPix(t: { descricao: string | null; categoria_pluggy: string | null }): boolean {
  const cat = String(t.categoria_pluggy ?? "");
  if (CATEGORIAS_PROPRIAS.test(cat)) return false;
  return /\bpix\b/i.test(String(t.descricao ?? "")) || /pix/i.test(cat);
}

const data10 = (v: string | null) => String(v ?? "").slice(0, 10);

/** Carrega um PIX do grupo de quem pede, ou falha. */
async function pixDoGrupo(db: any, ctx: Contexto, transactionId: string, tipo: "CREDIT" | "DEBIT") {
  const grupoId = await grupoDe(db, ctx.userId);
  if (!grupoId) throw new Error("Seu usuário não está em um grupo.");
  const contas = await contasDoGrupo(db, grupoId);
  const { data: t } = await db
    .from("pluggy_transacoes")
    .select("transaction_id, account_id, data, descricao, valor, tipo, status, categoria_pluggy, pix_situacao")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  const conta = contas.find((c) => c.accountId === t?.account_id);
  if (!t || !conta || t.tipo !== tipo) throw new Error("PIX não encontrado.");
  if (t.pix_situacao === "lancado") throw new Error("Este PIX já foi lançado.");
  return { t, conta, grupoId, data: data10(t.data), valor: Math.abs(Number(t.valor) || 0) };
}

async function marcarPix(db: any, transactionId: string, situacao: "lancado" | "ignorado" | null, lancamentoId?: string | null) {
  const { error } = await db
    .from("pluggy_transacoes")
    .update({
      pix_situacao: situacao,
      pix_lancamento_id: lancamentoId ?? null,
      pix_tratado_em: situacao ? new Date().toISOString() : null,
    })
    .eq("transaction_id", transactionId);
  if (error) throw new Error("Não foi possível atualizar o PIX.");
}

export type PixListado = {
  id: string;
  data: string;
  descricao: string | null;
  valor: number;
  banco: string;
  situacao: "pendente" | "lancado" | "ignorado";
};

/** PIX recebidos (entrada) ou enviados (saída) das contas correntes do grupo, mais recentes primeiro. */
export const listarPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ direcao: z.enum(["entrada", "saida"]) }).parse(d))
  .handler(async ({ data, context }): Promise<{ disponivel: boolean; itens: PixListado[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const grupoId = await grupoDe(db, context.userId);
    if (!grupoId) return { disponivel: false, itens: [] };
    const contas = await contasDoGrupo(db, grupoId);
    if (!contas.length) return { disponivel: false, itens: [] };

    const desde = new Date(Date.now() - DIAS_LISTA * 86400000).toISOString().slice(0, 10);
    const { data: linhas, error } = await db
      .from("pluggy_transacoes")
      .select("transaction_id, account_id, data, descricao, valor, status, categoria_pluggy, pix_situacao")
      .in("account_id", contas.map((c) => c.accountId))
      .eq("tipo", data.direcao === "entrada" ? "CREDIT" : "DEBIT")
      .gte("data", desde)
      .order("data", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Não foi possível ler os PIX.");

    const pix = (linhas ?? []).filter((t: any) => t.status !== "PENDING" && ehPix(t));
    // PIX que já viraram lançamento por outro caminho (regra automática, conciliação antiga).
    const ids = pix.map((t: any) => t.transaction_id);
    const jaLancados = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const lote = ids.slice(i, i + 200);
      const tabela = data.direcao === "entrada" ? "receitas" : "despesas";
      const { data: ls } = await db.from(tabela).select("pluggy_transaction_id").in("pluggy_transaction_id", lote);
      for (const l of ls ?? []) jaLancados.add(String(l.pluggy_transaction_id));
    }

    return {
      disponivel: true,
      itens: pix.map((t: any) => ({
        id: String(t.transaction_id),
        data: data10(t.data),
        descricao: t.descricao ?? null,
        valor: Math.abs(Number(t.valor) || 0),
        banco: contas.find((c) => c.accountId === t.account_id)?.banco ?? "Conta",
        situacao:
          t.pix_situacao === "ignorado"
            ? "ignorado"
            : t.pix_situacao === "lancado" || jaLancados.has(String(t.transaction_id))
              ? "lancado"
              : "pendente",
      })),
    };
  });

/** Ignora um PIX (não vira lançamento) ou desfaz o ignorar. */
export const ignorarPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ transactionId: z.string().min(1).max(200), desfazer: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const grupoId = await grupoDe(db, context.userId);
    if (!grupoId) throw new Error("Seu usuário não está em um grupo.");
    const contas = await contasDoGrupo(db, grupoId);
    const { data: t } = await db
      .from("pluggy_transacoes")
      .select("account_id, pix_situacao")
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (!t || !contas.some((c) => c.accountId === t.account_id)) throw new Error("PIX não encontrado.");
    if (t.pix_situacao === "lancado") throw new Error("Este PIX já foi lançado.");
    await marcarPix(db, data.transactionId, data.desfazer ? null : "ignorado");
    return { ok: true as const };
  });

const schemaReceita = z.object({
  transactionId: z.string().min(1).max(200),
  modo: z.enum(["nova_variavel", "nova_fixa", "substituir"]),
  receitaId: z.string().uuid().optional(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  descricao: z.string().trim().min(1).max(120).optional(),
  categoria: z.string().trim().min(1).max(80).optional(),
  responsavel: z.string().trim().max(120).optional().nullable(),
  criarRegra: z.boolean().optional(),
});

/**
 * Lança um PIX recebido como receita:
 *  - nova_variavel: receita avulsa com o valor e a data do PIX;
 *  - nova_fixa: receita fixa (todo mês) a partir da data do PIX;
 *  - substituir: troca a receita escolhida daquele mês pelo valor recebido. Se ela for fixa, sai
 *    só a ocorrência do mês (a série continua) e entra o valor do PIX.
 * criarRegra: nas próximas sincronizações, PIX parecido substitui a mesma receita fixa sozinho.
 */
export const lancarPixComoReceita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schemaReceita.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const sb = context.supabase as any; // escrita com as regras de acesso (RLS) de quem pede
    const pix = await pixDoGrupo(db, context as Contexto, data.transactionId, "CREDIT");
    const agora = new Date().toISOString();
    let lancamentoId: string;
    let descricaoRegra: string | null = null;

    if (data.modo === "substituir") {
      if (!data.receitaId || !data.competencia) throw new Error("Escolha a receita que será substituída.");
      const { data: receita } = await sb.from("receitas").select("*").eq("id", data.receitaId).maybeSingle();
      if (!receita) throw new Error("Receita não encontrada.");
      if (receita.origem === "pluggy") throw new Error("Esta receita já veio do banco.");
      if (receita.recorrente) {
        const { excluirReceitaSerie } = await import("@/lib/exclusao-recorrente");
        await excluirReceitaSerie(sb, receita, data.competencia, "so_competencia");
        const { data: nova, error } = await sb
          .from("receitas")
          .insert({
            descricao: receita.descricao,
            valor: pix.valor,
            moeda: "BRL",
            categoria: receita.categoria ?? "Outras receitas",
            data_recebimento: pix.data,
            recorrente: false,
            responsavel: receita.responsavel ?? null,
            cartao_id: receita.cartao_id ?? null,
            observacoes: `Recebido por PIX (Open Finance). Substituiu a receita fixa de ${data.competencia}.`,
            origem: "pluggy",
            pluggy_transaction_id: pix.t.transaction_id,
            importada_em: agora,
            congelada: false,
            possivel_duplicidade: false,
            created_by: context.userId,
            grupo_id: receita.grupo_id ?? pix.grupoId,
          })
          .select("id")
          .single();
        if (error || !nova) throw new Error("Não foi possível lançar a receita do PIX.");
        lancamentoId = nova.id;
        descricaoRegra = receita.descricao;
      } else {
        const { data: atualizada, error } = await sb
          .from("receitas")
          .update({
            valor: pix.valor,
            data_recebimento: pix.data,
            origem: "pluggy",
            pluggy_transaction_id: pix.t.transaction_id,
            importada_em: agora,
            possivel_duplicidade: false,
          })
          .eq("id", receita.id)
          .select("id");
        if (error || !atualizada?.length) throw new Error("Não foi possível substituir a receita.");
        lancamentoId = receita.id;
      }
    } else {
      const descricao = data.descricao ?? "PIX recebido";
      const base = {
        descricao,
        valor: pix.valor,
        moeda: "BRL",
        categoria: data.categoria ?? "Outras receitas",
        data_recebimento: pix.data,
        responsavel: data.responsavel ?? null,
        created_by: context.userId,
        grupo_id: pix.grupoId,
        possivel_duplicidade: false,
      };
      const linha =
        data.modo === "nova_fixa"
          ? {
              ...base,
              // A série fica como lançamento comum (não congela); o PIX fica ligado a ela.
              recorrente: true,
              frequencia: "mensal",
              recorrencia_inicio: pix.data,
              recorrencia_sem_prazo: true,
              origem: "manual",
              observacoes: "Criada a partir de um PIX recebido (Open Finance).",
            }
          : {
              ...base,
              recorrente: false,
              origem: "pluggy",
              pluggy_transaction_id: pix.t.transaction_id,
              importada_em: agora,
              congelada: false,
            };
      const { data: nova, error } = await sb.from("receitas").insert(linha).select("id").single();
      if (error || !nova) throw new Error("Não foi possível lançar a receita do PIX.");
      lancamentoId = nova.id;
      if (data.modo === "nova_fixa") descricaoRegra = descricao;
    }

    await marcarPix(db, pix.t.transaction_id, "lancado", lancamentoId);

    if (data.criarRegra && descricaoRegra) {
      await db.from("regras_pix_receita").insert({
        nome: `PIX para ${descricaoRegra}`.slice(0, 120),
        receita_descricao: descricaoRegra,
        valor_minimo: Math.floor(pix.valor * 0.8 * 100) / 100,
        valor_maximo: Math.ceil(pix.valor * 1.2 * 100) / 100,
        dias_tolerancia: 5,
        ativo: true,
        created_by: context.userId,
      });
    }
    return { ok: true as const, lancamentoId };
  });

const schemaDespesa = z.object({
  transactionId: z.string().min(1).max(200),
  modo: z.enum(["nova", "substituir"]),
  despesaId: z.string().uuid().optional(),
  descricao: z.string().trim().min(1).max(120).optional(),
  categoria: z.string().trim().min(1).max(80).optional(),
  responsavel: z.string().trim().max(120).optional().nullable(),
});

/**
 * Lança um PIX enviado como despesa (paga, à vista, na conta do banco) ou substitui uma despesa
 * à vista lançada à mão naquele período pelo valor e data do PIX.
 */
export const lancarPixComoDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schemaDespesa.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const sb = context.supabase as any;
    const pix = await pixDoGrupo(db, context as Contexto, data.transactionId, "DEBIT");
    const agora = new Date().toISOString();
    let lancamentoId: string;

    if (data.modo === "substituir") {
      if (!data.despesaId) throw new Error("Escolha a despesa que será substituída.");
      const { data: despesa } = await sb.from("despesas").select("*").eq("id", data.despesaId).maybeSingle();
      if (!despesa) throw new Error("Despesa não encontrada.");
      if (despesa.origem === "pluggy" || despesa.pluggy_transaction_id) throw new Error("Esta despesa já veio do banco.");
      if (despesa.tipo === "fixa" || Number(despesa.total_parcelas) !== 1)
        throw new Error("Só dá para substituir despesa à vista (uma parcela).");
      const { data: atualizada, error } = await sb
        .from("despesas")
        .update({
          valor_total: pix.valor,
          data_compra: pix.data,
          data_primeira_parcela: pix.data,
          banco_id: pix.conta.bancoId,
          banco_nome: pix.conta.banco,
          origem: "pluggy",
          pluggy_transaction_id: pix.t.transaction_id,
          importada_em: agora,
          possivel_duplicidade: false,
        })
        .eq("id", despesa.id)
        .select("id");
      if (error || !atualizada?.length) throw new Error("Não foi possível substituir a despesa.");
      await sb
        .from("parcelas")
        .update({ valor: pix.valor, vencimento: pix.data, paga: true, data_pagamento: pix.data })
        .eq("despesa_id", despesa.id);
      lancamentoId = despesa.id;
    } else {
      const { data: nova, error } = await sb
        .from("despesas")
        .insert({
          descricao: data.descricao ?? "PIX enviado",
          valor_total: pix.valor,
          moeda: "BRL",
          categoria: data.categoria ?? "Categoria a confirmar",
          tipo: "variavel",
          data_compra: pix.data,
          total_parcelas: 1,
          data_primeira_parcela: pix.data,
          banco_id: pix.conta.bancoId,
          banco_nome: pix.conta.banco,
          responsavel: data.responsavel ?? null,
          origem: "pluggy",
          pluggy_transaction_id: pix.t.transaction_id,
          importada_em: agora,
          congelada: false,
          possivel_duplicidade: false,
          created_by: context.userId,
          grupo_id: pix.grupoId,
        })
        .select("id")
        .single();
      if (error || !nova) throw new Error("Não foi possível lançar a despesa do PIX.");
      const { error: e2 } = await sb.from("parcelas").insert({
        despesa_id: nova.id,
        numero: 1,
        total: 1,
        valor: pix.valor,
        moeda: "BRL",
        vencimento: pix.data,
        paga: true,
        data_pagamento: pix.data,
        grupo_id: pix.grupoId,
      });
      if (e2) {
        await sb.from("despesas").delete().eq("id", nova.id);
        throw new Error("Não foi possível criar a parcela da despesa do PIX.");
      }
      lancamentoId = nova.id;
    }

    await marcarPix(db, pix.t.transaction_id, "lancado", lancamentoId);
    return { ok: true as const, lancamentoId };
  });

/** Regras automáticas de PIX (de-para) de quem pede. */
export const listarRegrasPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("regras_pix_receita")
      .select("id, nome, receita_descricao, valor_minimo, valor_maximo, dias_tolerancia, ativo")
      .eq("created_by", context.userId)
      .order("created_at");
    return (data ?? []) as {
      id: string;
      nome: string;
      receita_descricao: string;
      valor_minimo: number;
      valor_maximo: number;
      dias_tolerancia: number;
      ativo: boolean;
    }[];
  });

export const excluirRegraPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: apagada } = await (supabaseAdmin as any)
      .from("regras_pix_receita")
      .delete()
      .eq("id", data.id)
      .eq("created_by", context.userId)
      .select("id");
    if (!apagada?.length) throw new Error("Regra não encontrada.");
    return { ok: true as const };
  });
