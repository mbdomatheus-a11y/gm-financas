import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Contas criadas antes desta data nunca recebem dados de exemplo. */
const DATA_CORTE = "2026-10-06T00:00:00Z";
const MARCA = "Exemplo fictício";

const CATEGORIAS_DESPESA = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Contas e assinaturas",
  "Outros",
];
const CATEGORIAS_RECEITA = ["Salário", "Vale", "Outras receitas"];

function dataNoMes(dia: number): string {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  return d.toISOString().slice(0, 10);
}

/**
 * Cria, uma única vez por novo usuário, um conjunto pequeno de dados fictícios
 * para ele entender o site: categorias amplas, receitas (Vale dia 15, Salário
 * dia 30), um cartão e um investimento de teste. Só roda se a conta é nova e o
 * grupo ainda está totalmente vazio, para nunca misturar com dados reais.
 */
export const semearDadosExemplo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const uid = context.userId;

    const { data: ja } = await db
      .from("dados_exemplo_semeados")
      .select("user_id,visto_em")
      .eq("user_id", uid)
      .maybeSingle();
    if (ja) return { mostrar: !ja.visto_em };

    const { data: perfil } = await db
      .from("profiles")
      .select("grupo_id,created_at,nome")
      .eq("id", uid)
      .maybeSingle();
    const grupoId = perfil?.grupo_id as string | undefined;
    if (!grupoId || !perfil?.created_at || perfil.created_at < DATA_CORTE) {
      return { mostrar: false };
    }

    const tabelas = ["categorias", "receitas", "despesas", "cartoes", "investimentos"];
    for (const t of tabelas) {
      const { count } = await db
        .from(t)
        .select("id", { count: "exact", head: true })
        .eq("grupo_id", grupoId);
      if ((count ?? 0) > 0) {
        await db.from("dados_exemplo_semeados").upsert({
          user_id: uid,
          grupo_id: grupoId,
          visto_em: new Date().toISOString(),
        });
        return { mostrar: false };
      }
    }

    // Marca primeiro: se algo falhar no meio, não tenta de novo em loop.
    await db.from("dados_exemplo_semeados").insert({ user_id: uid, grupo_id: grupoId });

    await db.from("categorias").insert([
      ...CATEGORIAS_DESPESA.map((nome) => ({ nome, tipo: "despesa", grupo_id: grupoId })),
      ...CATEGORIAS_RECEITA.map((nome) => ({ nome, tipo: "receita", grupo_id: grupoId })),
    ]);

    const base = {
      moeda: "BRL",
      recorrente: true,
      frequencia: "mensal",
      recorrencia_sem_prazo: true,
      observacoes: MARCA,
      created_by: uid,
      grupo_id: grupoId,
    };
    await db.from("receitas").insert([
      {
        ...base,
        descricao: "Vale dia 15 (exemplo)",
        valor: 600,
        categoria: "Vale",
        data_recebimento: dataNoMes(15),
        recorrencia_inicio: dataNoMes(15),
      },
      {
        ...base,
        descricao: "Salário dia 30 (exemplo)",
        valor: 3000,
        categoria: "Salário",
        data_recebimento: dataNoMes(28),
        recorrencia_inicio: dataNoMes(28),
      },
      {
        ...base,
        descricao: "Renda extra (exemplo)",
        valor: 250,
        categoria: "Outras receitas",
        recorrente: false,
        frequencia: null,
        recorrencia_sem_prazo: false,
        data_recebimento: dataNoMes(10),
        recorrencia_inicio: null,
      },
    ]);

    await db.from("cartoes").insert({
      titular: String(perfil.nome ?? "Titular Exemplo"),
      final: "0000",
      bandeira: "Visa",
      tipo: "credito",
      apelido: "Cartão Exemplo",
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite: 2000,
      grupo_id: grupoId,
    });

    await db.from("investimentos").insert({
      nome: "Investimento de teste",
      tipo: "Renda fixa",
      instituicao: "Banco Exemplo",
      valor_investido: 1000,
      valor_atual: 1012.5,
      data_investimento: dataNoMes(1),
      observacoes: MARCA,
      created_by: uid,
      grupo_id: grupoId,
    });

    return { mostrar: true };
  });

export const marcarExemplosVistos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("dados_exemplo_semeados")
      .update({ visto_em: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true as const };
  });

/**
 * Apaga tudo o que foi criado como exemplo: receitas, investimento, cartão e
 * as categorias de exemplo que não estiverem em uso. Identifica pela marca
 * (observação "Exemplo fictício"), pelo "(exemplo)" no nome da receita e pelo
 * "Cartão Exemplo" final 0000. Qualquer falha agora aparece para o usuário
 * (antes os erros eram ignorados e as receitas podiam ficar).
 */
export const removerDadosExemplo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: perfil } = await db
      .from("profiles")
      .select("grupo_id")
      .eq("id", context.userId)
      .maybeSingle();
    const g = perfil?.grupo_id as string | undefined;
    if (!g) return { ok: true as const, removidos: 0 };
    let removidos = 0;
    const apagar = async (consulta: any, rotulo: string) => {
      const { data, error } = await consulta.select("id");
      if (error) throw new Error(`Não foi possível remover ${rotulo}: ${error.message}`);
      removidos += (data ?? []).length;
    };
    await apagar(db.from("receitas").delete().eq("grupo_id", g).eq("observacoes", MARCA), "as receitas de exemplo");
    await apagar(
      db.from("receitas").delete().eq("grupo_id", g).ilike("descricao", "%(exemplo)"),
      "as receitas de exemplo",
    );
    await apagar(db.from("investimentos").delete().eq("grupo_id", g).eq("observacoes", MARCA), "o investimento de teste");
    await apagar(
      db.from("investimentos").delete().eq("grupo_id", g).eq("nome", "Investimento de teste"),
      "o investimento de teste",
    );
    await apagar(
      db.from("cartoes").delete().eq("grupo_id", g).eq("apelido", "Cartão Exemplo").eq("final", "0000"),
      "o cartão de exemplo",
    );
    // Categorias de exemplo: só as que nenhum lançamento usa.
    const nomes = [...CATEGORIAS_DESPESA, ...CATEGORIAS_RECEITA];
    const [{ data: usadasD }, { data: usadasR }] = await Promise.all([
      db.from("despesas").select("categoria").eq("grupo_id", g).in("categoria", nomes),
      db.from("receitas").select("categoria").eq("grupo_id", g).in("categoria", nomes),
    ]);
    const emUso = new Set([...(usadasD ?? []), ...(usadasR ?? [])].map((x: any) => x.categoria));
    const livres = nomes.filter((n) => !emUso.has(n));
    if (livres.length) {
      await apagar(db.from("categorias").delete().eq("grupo_id", g).in("nome", livres), "as categorias de exemplo");
    }
    await db
      .from("dados_exemplo_semeados")
      .update({ visto_em: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true as const, removidos };
  });

/** Quantos itens de exemplo ainda existem no grupo (para mostrar o botão de remover). */
export const contarDadosExemplo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: perfil } = await db
      .from("profiles")
      .select("grupo_id")
      .eq("id", context.userId)
      .maybeSingle();
    const g = perfil?.grupo_id as string | undefined;
    if (!g) return { total: 0 };
    const contar = async (q: any) => (await q).count ?? 0;
    const total =
      (await contar(
        db.from("receitas").select("id", { count: "exact", head: true }).eq("grupo_id", g).ilike("descricao", "%(exemplo)"),
      )) +
      (await contar(
        db.from("investimentos").select("id", { count: "exact", head: true }).eq("grupo_id", g).eq("observacoes", MARCA),
      )) +
      (await contar(
        db
          .from("cartoes")
          .select("id", { count: "exact", head: true })
          .eq("grupo_id", g)
          .eq("apelido", "Cartão Exemplo")
          .eq("final", "0000"),
      ));
    return { total };
  });
