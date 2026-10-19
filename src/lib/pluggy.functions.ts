import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração Pluggy (Open Finance). Fase de teste: SOMENTE o administrador
 * principal. As credenciais ficam nas variáveis de ambiente do servidor
 * (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET) e nunca vão para o navegador.
 * Aqui só se guarda o id da conexão (item); nenhuma senha bancária passa por nós.
 */
const BASE = "https://api.pluggy.ai";

async function exigirPrincipal(userId: string) {
  const { ehAdminPrincipal } = await import("@/lib/conta-exclusao.server");
  if (!(await ehAdminPrincipal(userId))) throw new Error("Recurso em teste, restrito ao administrador principal.");
}

function credenciais() {
  const clientId = process.env["PLUGGY_CLIENT_ID"];
  const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function apiKey(): Promise<string> {
  const c = credenciais();
  if (!c) throw new Error("Credenciais da Pluggy não configuradas no servidor.");
  const r = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
  if (!r.ok) throw new Error("A Pluggy recusou as credenciais.");
  const j = (await r.json()) as { apiKey?: string };
  if (!j.apiKey) throw new Error("Resposta inesperada da Pluggy.");
  return j.apiKey;
}

async function pluggy<T>(key: string, caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { "X-API-KEY": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`Falha ao consultar a Pluggy (${r.status}).`);
  return (await r.json()) as T;
}

export const pluggyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    return { configurado: !!credenciais() };
  });

/** Gera o token de uso único do widget Pluggy Connect (vale por poucos minutos). */
export const pluggyCriarConnectToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const key = await apiKey();
    const j = await pluggy<{ accessToken: string }>(key, "/connect_token", {
      method: "POST",
      body: JSON.stringify({ options: { clientUserId: context.userId, avoidDuplicates: true } }),
    });
    return { accessToken: j.accessToken };
  });

export const pluggyRegistrarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ itemId: z.string().uuid(), conector: z.string().max(120).optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("pluggy_items").upsert(
      {
        user_id: context.userId,
        item_id: data.itemId,
        conector: data.conector ?? null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );
    if (error) throw new Error("Não foi possível guardar a conexão.");
    return { ok: true as const };
  });

export const pluggyListarItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("pluggy_items")
      .select("id,item_id,conector,status,criado_em")
      .eq("user_id", context.userId)
      .order("criado_em", { ascending: false });
    return { itens: (data ?? []) as { id: string; item_id: string; conector: string | null; status: string | null; criado_em: string }[] };
  });

/** Renomeia a conexão (nome do banco que aparece na tela, para os casos sem banco identificado). */
export const pluggyEditarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ itemId: z.string().uuid(), nome: z.string().trim().min(1).max(120) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("pluggy_items")
      .update({ conector: data.nome, atualizado_em: new Date().toISOString() })
      .eq("item_id", data.itemId)
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível salvar o nome da conexão.");
    return { ok: true as const };
  });

export const pluggyRemoverItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ itemId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: meu } = await db
      .from("pluggy_items")
      .select("id")
      .eq("item_id", data.itemId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!meu) throw new Error("Conexão não encontrada.");
    try {
      const key = await apiKey();
      await fetch(`${BASE}/items/${data.itemId}`, { method: "DELETE", headers: { "X-API-KEY": key } });
    } catch {
      /* se a Pluggy falhar, ainda removemos o vínculo local */
    }
    await db.from("pluggy_contas").update({ ativo: false, atualizado_em: new Date().toISOString() }).eq("item_id", data.itemId).eq("user_id", context.userId);
    await db.from("pluggy_items").delete().eq("item_id", data.itemId).eq("user_id", context.userId);
    return { ok: true as const };
  });

/** Sincroniza agora uma conexão (todo o histórico da janela), a pedido do administrador. */
export const pluggySincronizarAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ itemId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { sincronizarItem } = await import("@/lib/pluggy-api.server");
    const r = await sincronizarItem(data.itemId);
    return { ok: true as const, transacoes: r.transacoes };
  });

/** Sincroniza todos os bancos conectados de uma vez (botão único na página Bancos). */
export const pluggySincronizarTodos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sincronizarItem } = await import("@/lib/pluggy-api.server");
    const { data: itens } = await (supabaseAdmin as any).from("pluggy_items").select("item_id").eq("user_id", context.userId);
    let ok = 0;
    let falhas = 0;
    let lancamentos = 0;
    for (const { item_id } of (itens ?? []) as { item_id: string }[]) {
      try {
        const r = await sincronizarItem(item_id);
        lancamentos += r.transacoes;
        ok++;
      } catch {
        falhas++;
      }
    }
    return { ok, falhas, lancamentos };
  });

/** Histórico das sincronizações (automáticas e manuais), mais recentes primeiro. */
export const pluggyListarSincronizacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("pluggy_sincronizacoes")
      .select("id,item_id,iniciado_em,terminado_em,status,primeira,transacoes_lidas,despesas_criadas,mensagem")
      .eq("user_id", context.userId)
      .order("iniciado_em", { ascending: false })
      .limit(40);
    return { historico: (data ?? []) as any[] };
  });

/** Investimentos e empréstimos das conexões ativas. */
export const pluggyListarPatrimonio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [inv, emp] = await Promise.all([
      db.from("pluggy_investimentos").select("id,nome,tipo,instituicao,saldo,valor_aplicado,rentabilidade_anual,vencimento").eq("user_id", context.userId).gt("saldo", 0).order("saldo", { ascending: false }),
      db.from("pluggy_emprestimos").select("id,tipo,instituicao,valor_contratado,saldo_devedor,taxa_anual,indexador,vencimento").eq("user_id", context.userId),
    ]);
    return { investimentos: (inv.data ?? []) as any[], emprestimos: (emp.data ?? []) as any[] };
  });

/** Contas e cartões conectados, com limite, fatura e saldo. */
export const pluggyListarContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data } = await db
      .from("pluggy_contas")
      .select("id,item_id,banco_id,nome,tipo,cartao_final,numero_conta,titular,limite,limite_disponivel,fatura_valor,fatura_vencimento,saldo,atualizado_em")
      .eq("user_id", context.userId)
      .eq("ativo", true)
      .order("tipo", { ascending: true });
    const contas = (data ?? []) as any[];
    // Nome do banco e bandeira do cartão, para a tela mostrar o que é cada conta (e não só o código).
    const { data: perfil } = await db.from("profiles").select("grupo_id").eq("id", context.userId).maybeSingle();
    const grupoId: string | null = perfil?.grupo_id ?? null;
    const bancoIds = [...new Set(contas.map((c) => c.banco_id).filter(Boolean))];
    const finais = [...new Set(contas.map((c) => c.cartao_final).filter(Boolean))];
    const { data: bancos } = bancoIds.length ? await db.from("bancos").select("id,nome").in("id", bancoIds) : { data: [] };
    let cartoesQ = db.from("cartoes").select("final,bandeira").in("final", finais.length ? finais : ["-"]);
    cartoesQ = grupoId ? cartoesQ.eq("grupo_id", grupoId) : cartoesQ.is("grupo_id", null);
    const { data: cartoes } = await cartoesQ;
    const nomeBanco = new Map<string, string>((bancos ?? []).map((b: any) => [b.id, b.nome]));
    const bandeiraPorFinal = new Map<string, string>((cartoes ?? []).map((c: any) => [c.final, c.bandeira]));
    return {
      contas: contas.map((c) => ({
        ...c,
        banco_nome: c.banco_id ? (nomeBanco.get(c.banco_id) ?? null) : null,
        bandeira: c.cartao_final ? (bandeiraPorFinal.get(c.cartao_final) ?? null) : null,
      })),
    };
  });

/** Lançamentos importados automaticamente (aprovados por padrão), para o usuário revisar e rejeitar. */
export const pluggyListarImportados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("despesas")
      .select("id,descricao,valor_total,data_compra,cartao_final,banco_nome,pluggy_transaction_id,importada_em,congelada")
      .eq("origem", "pluggy")
      .eq("created_by", context.userId)
      .order("data_compra", { ascending: false })
      .limit(200);
    return {
      itens: (data ?? []) as {
        id: string;
        descricao: string;
        valor_total: number;
        data_compra: string;
        cartao_final: string | null;
        banco_nome: string | null;
        pluggy_transaction_id: string;
        importada_em: string | null;
        congelada: boolean;
      }[],
    };
  });

/**
 * Rejeita um lançamento importado: marca a transação para não voltar nunca.
 * Se ele tinha substituído um lançamento manual, o manual volta ao lugar.
 */
export const pluggyRejeitarLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ transactionId: z.string().min(1).max(200) }).parse(v))
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: transacao } = await db
      .from("pluggy_transacoes")
      .select("transaction_id,substituiu_manual")
      .eq("transaction_id", data.transactionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!transacao) throw new Error("Lançamento não encontrado.");

    const { data: despesa } = await db
      .from("despesas")
      .select("id")
      .eq("pluggy_transaction_id", data.transactionId)
      .eq("created_by", context.userId)
      .maybeSingle();
    if (despesa) {
      if (transacao.substituiu_manual) {
        await db.from("despesas").update({ origem: "manual", pluggy_transaction_id: null }).eq("id", despesa.id);
      } else {
        await db.from("parcelas").delete().eq("despesa_id", despesa.id);
        await db.from("despesas").delete().eq("id", despesa.id);
      }
    }
    const { data: receita } = await db
      .from("receitas")
      .select("id")
      .eq("pluggy_transaction_id", data.transactionId)
      .eq("created_by", context.userId)
      .maybeSingle();
    if (receita) {
      const { error } = await db.from("receitas").delete().eq("id", receita.id);
      if (error) throw new Error("Esta entrada já está congelada e não pode ser rejeitada.");
    }
    await db.from("pluggy_transacoes").update({ rejeitada: true }).eq("transaction_id", data.transactionId);
    return { ok: true as const };
  });

type Conta = {
  id: string;
  type: string;
  subtype: string;
  name: string;
  number?: string;
  balance: number;
  currencyCode: string;
};
type Transacao = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  status?: string;
};

/** Contas e movimentos dos últimos N dias (somente leitura, nada é gravado no site). */
export const pluggyBuscarMovimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ itemId: z.string().uuid(), dias: z.number().int().min(1).max(90).default(30) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await exigirPrincipal(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: meu } = await (supabaseAdmin as any)
      .from("pluggy_items")
      .select("id")
      .eq("item_id", data.itemId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!meu) throw new Error("Conexão não encontrada.");
    const key = await apiKey();
    const item = await pluggy<{ status?: string }>(key, `/items/${data.itemId}`);
    await (supabaseAdmin as any)
      .from("pluggy_items")
      .update({ status: item.status ?? null, atualizado_em: new Date().toISOString() })
      .eq("item_id", data.itemId);
    const contas = await pluggy<{ results: Conta[] }>(key, `/accounts?itemId=${data.itemId}`);
    const de = new Date(Date.now() - data.dias * 86400000).toISOString();
    const saida: { conta: Conta; transacoes: Transacao[] }[] = [];
    for (const conta of contas.results ?? []) {
      const transacoes: Transacao[] = [];
      let depois: string | null = null;
      for (let pagina = 0; pagina < 10; pagina++) {
        const qs = new URLSearchParams({ accountId: conta.id, dateFrom: de });
        if (depois) qs.set("after", depois);
        const r: { results: Transacao[]; next: string | null } = await pluggy(key, `/v2/transactions?${qs.toString()}`);
        transacoes.push(...(r.results ?? []));
        if (!r.next) break;
        const m = /after=([^&]+)/.exec(r.next);
        depois = m ? decodeURIComponent(m[1]!) : null;
        if (!depois) break;
      }
      saida.push({ conta, transacoes });
    }
    return { status: item.status ?? null, contas: saida };
  });
