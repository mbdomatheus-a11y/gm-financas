import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Funil de conversão e retenção (2026-10-17, plano de retenção).
 *
 * Eventos gravados em `eventos_funil` (só a service_role grava e lê):
 * - home_rolagem: quanto da home o visitante rolou (valor = 25, 50, 75 ou 100);
 * - clique_cadastrar: clicou num botão de criar conta (caminho diz de onde);
 * - primeiros_passos_visto / primeiros_passos_concluido: guia do 1º lançamento;
 * - instalar_app_clique: aceitou instalar o site na tela inicial.
 * Cadastro, 1º lançamento e retorno vêm das próprias tabelas (profiles, despesas,
 * receitas, import_lotes, eventos_sessao), sem duplicar dado.
 */

export const EVENTOS_FUNIL = [
  "home_rolagem",
  "clique_cadastrar",
  "primeiros_passos_visto",
  "primeiros_passos_concluido",
  "instalar_app_clique",
  // 31/10/2026: lembrete fixo do 1º lançamento e "Criar conta" depois de errar o login.
  "primeiros_passos_lembrete",
  "login_erro_criar_conta",
] as const;

export const registrarEventoFunil = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z
      .object({
        evento: z.enum(EVENTOS_FUNIL),
        sessao: z.string().max(64).nullish(),
        caminho: z.string().max(300).nullish(),
        valor: z.number().int().min(0).max(100_000).nullish(),
        utmSource: z.string().max(80).nullish(),
        utmCampaign: z.string().max(120).nullish(),
        token: z.string().max(4000).nullish(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    try {
      const ua = getRequest().headers.get("user-agent") ?? "";
      if (/bot|crawl|spider|preview|headless|lighthouse|vercel/i.test(ua)) return { ok: true };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      let userId: string | null = null;
      if (data.token) {
        const { data: u } = await db.auth.getUser(data.token);
        userId = u?.user?.id ?? null;
      }
      await db.from("eventos_funil").insert({
        evento: data.evento,
        sessao: data.sessao ?? null,
        user_id: userId,
        caminho: data.caminho ?? null,
        valor: data.valor ?? null,
        utm_source: data.utmSource ?? null,
        utm_campaign: data.utmCampaign ?? null,
        dispositivo: /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "celular" : "computador",
      });
    } catch {
      // Telemetria nunca atrapalha a navegação.
    }
    return { ok: true };
  });

/** Contador público de usuários (home): total e novos nos últimos 30 dias. */
export const contadorUsuariosPublico = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ count: total }, { count: novos30 }] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", desde),
    ]);
    return { total: total ?? 0, novos30: novos30 ?? 0 };
  } catch {
    return { total: 0, novos30: 0 };
  }
});

export type EtapaFunil = { chave: string; rotulo: string; qtd: number; ajuda: string };

export type FunilAdmin = {
  dias: number;
  novosUsuarios: { hoje: number; d7: number; d30: number; total: number };
  ultimosCadastros: { nome: string; criadoEm: string; lancou: boolean; voltou: boolean }[];
  visitantes: EtapaFunil[];
  usuarios: EtapaFunil[];
  porCampanha: { origem: string; visitantes: number; cliques: number }[];
  observacao: string;
};

const unicos = <T,>(arr: T[]) => new Set(arr).size;

async function lerTudo(db: any, tabela: string, colunas: string, desde: string, campoData: string) {
  const todos: any[] = [];
  for (let de = 0; de < 100_000; de += 1000) {
    const { data: rows, error } = await db
      .from(tabela)
      .select(colunas)
      .gte(campoData, desde)
      .order(campoData, { ascending: false })
      .range(de, de + 999);
    if (error) throw new Error(`Não foi possível ler ${tabela}.`);
    todos.push(...(rows ?? []));
    if (!rows || rows.length < 1000) break;
  }
  return todos;
}

/** Funil para o painel da administração. Só contagens: nenhum valor financeiro de grupo. */
export const adminFunil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ dias: z.number().int().min(1).max(365) }).parse(v))
  .handler(async ({ data, context }): Promise<FunilAdmin> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: adm } = await db.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!adm) throw new Error("Acesso restrito à administração do site.");

    const agora = Date.now();
    const desde = new Date(agora - data.dias * 86_400_000).toISOString();
    const iso = (d: number) => new Date(agora - d * 86_400_000).toISOString();
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    const [{ data: admins }, acessos, eventos, { data: perfis }, contagens] = await Promise.all([
      db.from("site_admins").select("user_id"),
      lerTudo(db, "acessos_site_log", "sessao,ip,user_id,caminho,utm_source,utm_campaign,referrer,user_agent", desde, "criado_em"),
      lerTudo(db, "eventos_funil", "evento,sessao,user_id,valor,caminho,utm_source,utm_campaign", desde, "criado_em"),
      db.from("profiles").select("id,nome,created_at").gte("created_at", iso(Math.max(data.dias, 30))).order("created_at", { ascending: false }),
      Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", inicioHoje.toISOString()),
        db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso(7)),
        db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso(30)),
        db.from("profiles").select("id", { count: "exact", head: true }),
      ]),
    ]);

    // Tráfego da própria administração não conta: some a sessão inteira em que um admin esteve logado.
    const idsAdmin = new Set<string>((admins ?? []).map((a: any) => a.user_id));
    const sessoesAdmin = new Set<string>();
    for (const a of [...acessos, ...eventos]) if (a.user_id && idsAdmin.has(a.user_id) && a.sessao) sessoesAdmin.add(a.sessao);
    const bot = /bot|crawl|spider|slurp|preview|headless|lighthouse|vercel/i;
    const acessosVisitantes = acessos.filter(
      (a) => !(a.sessao && sessoesAdmin.has(a.sessao)) && !(a.user_id && idsAdmin.has(a.user_id)) && !bot.test(a.user_agent ?? ""),
    );
    const eventosVisitantes = eventos.filter((e) => !(e.sessao && sessoesAdmin.has(e.sessao)) && !(e.user_id && idsAdmin.has(e.user_id)));
    const chaveVisitante = (a: any) => a.sessao ?? a.ip ?? "?";

    const porVisitante = new Map<string, any[]>();
    for (const a of acessosVisitantes) {
      const k = chaveVisitante(a);
      if (!porVisitante.has(k)) porVisitante.set(k, []);
      porVisitante.get(k)!.push(a);
    }
    const viuHome = [...porVisitante.values()].filter((l) => l.some((a) => a.caminho === "/"));
    const rolou50 = unicos(eventosVisitantes.filter((e) => e.evento === "home_rolagem" && (e.valor ?? 0) >= 50).map((e) => e.sessao));
    const cliques = unicos(eventosVisitantes.filter((e) => e.evento === "clique_cadastrar").map((e) => e.sessao));
    const viuEntrar = [...porVisitante.values()].filter((l) => l.some((a) => a.caminho === "/entrar")).length;

    // Usuários novos (fora da administração) no período: lançou algo e voltou em outro dia.
    const novos = (perfis ?? []).filter((p: any) => !idsAdmin.has(p.id) && p.created_at >= desde);
    const ids = novos.map((p: any) => p.id);
    const lancou = new Set<string>();
    const voltou = new Set<string>();
    if (ids.length) {
      const [{ data: d }, { data: r }, { data: l }, { data: s }] = await Promise.all([
        db.from("despesas").select("created_by").in("created_by", ids).limit(5000),
        db.from("receitas").select("created_by,created_at").in("created_by", ids).limit(5000),
        db.from("import_lotes").select("created_by").in("created_by", ids).limit(5000),
        db.from("eventos_sessao").select("user_id,iniciou_em,ultima_atividade_em").in("user_id", ids).limit(5000),
      ]);
      // Receitas de exemplo nascem junto com o cadastro: só conta receita criada 10 min depois.
      const criadoEm = new Map<string, number>(novos.map((p: any) => [p.id, new Date(p.created_at).getTime()]));
      for (const x of d ?? []) lancou.add(x.created_by);
      for (const x of l ?? []) lancou.add(x.created_by);
      for (const x of r ?? []) {
        if (new Date(x.created_at).getTime() - (criadoEm.get(x.created_by) ?? 0) > 10 * 60_000) lancou.add(x.created_by);
      }
      const diaDe = (t: string) => t.slice(0, 10);
      for (const x of s ?? []) {
        const c = criadoEm.get(x.user_id);
        if (!c) continue;
        for (const t of [x.iniciou_em, x.ultima_atividade_em]) {
          if (t && diaDe(t) !== diaDe(new Date(c).toISOString()) && new Date(t).getTime() - c <= 8 * 86_400_000) voltou.add(x.user_id);
        }
      }
    }

    const origem = (a: any) =>
      a.utm_campaign ? `${a.utm_source ?? "?"} / ${a.utm_campaign}` : a.utm_source ?? (a.referrer ? String(a.referrer).split("/")[0] : "direto");
    const visitantesPorOrigem = new Map<string, Set<string>>();
    for (const [k, l] of porVisitante) {
      const o = origem(l[l.length - 1]);
      if (!visitantesPorOrigem.has(o)) visitantesPorOrigem.set(o, new Set());
      visitantesPorOrigem.get(o)!.add(k);
    }
    const cliquesPorSessao = new Set(eventosVisitantes.filter((e) => e.evento === "clique_cadastrar").map((e) => e.sessao));
    const porCampanha = [...visitantesPorOrigem.entries()]
      .map(([o, s]) => ({ origem: o, visitantes: s.size, cliques: [...s].filter((k) => cliquesPorSessao.has(k)).length }))
      .sort((a, b) => b.visitantes - a.visitantes)
      .slice(0, 12);

    const [hoje, d7, d30, total] = contagens.map((c: any) => c.count ?? 0);
    return {
      dias: data.dias,
      novosUsuarios: { hoje, d7, d30, total },
      ultimosCadastros: (perfis ?? [])
        .filter((p: any) => !idsAdmin.has(p.id))
        .slice(0, 10)
        .map((p: any) => ({ nome: String(p.nome ?? "").split(" ")[0] || "Sem nome", criadoEm: p.created_at, lancou: lancou.has(p.id), voltou: voltou.has(p.id) })),
      visitantes: [
        { chave: "visitantes", rotulo: "Visitantes únicos", qtd: porVisitante.size, ajuda: "Sessões diferentes no período, sem robôs e sem a administração." },
        { chave: "home", rotulo: "Viram a home", qtd: viuHome.length, ajuda: "Abriram a página inicial pública." },
        { chave: "rolou", rotulo: "Rolaram metade da home", qtd: rolou50, ajuda: "Medido a partir de 17/10/2026." },
        { chave: "clique", rotulo: "Clicaram em criar conta", qtd: cliques, ajuda: "Medido a partir de 17/10/2026." },
        { chave: "entrar", rotulo: "Abriram a tela de cadastro/login", qtd: viuEntrar, ajuda: "Inclui quem só foi fazer login." },
      ],
      usuarios: [
        { chave: "cadastros", rotulo: "Cadastros", qtd: novos.length, ajuda: "Contas novas no período." },
        { chave: "lancou", rotulo: "Lançaram o 1º gasto ou fatura", qtd: novos.filter((p: any) => lancou.has(p.id)).length, ajuda: "Despesa, receita própria ou importação." },
        { chave: "voltou", rotulo: "Voltaram em outro dia (até 7 dias)", qtd: novos.filter((p: any) => voltou.has(p.id)).length, ajuda: "Entraram de novo depois do dia do cadastro." },
      ],
      porCampanha,
      observacao: "Rolagem e cliques começaram a ser medidos em 17/10/2026; antes disso aparecem zerados.",
    };
  });

/**
 * Primeiros passos (2026-10-17): diz se a pessoa já fez o próprio 1º lançamento
 * (despesa, importação de fatura ou receita criada depois dos exemplos) e, se sim,
 * um resumo curto do mês para mostrar o resultado na hora.
 */
export const statusPrimeirosPassos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const uid = context.userId;
    const { data: perfil } = await db.from("profiles").select("created_at,grupo_id").eq("id", uid).maybeSingle();
    if (!perfil) return { feito: true, lancamentos: 0, totalDespesasMes: 0 };
    const limiteExemplos = new Date(new Date(perfil.created_at).getTime() + 10 * 60_000).toISOString();
    const [{ count: desp }, { count: lotes }, { count: rec }] = await Promise.all([
      db.from("despesas").select("id", { count: "exact", head: true }).eq("created_by", uid),
      db.from("import_lotes").select("id", { count: "exact", head: true }).eq("created_by", uid),
      db.from("receitas").select("id", { count: "exact", head: true }).eq("created_by", uid).gte("created_at", limiteExemplos),
    ]);
    const lancamentos = (desp ?? 0) + (lotes ?? 0) + (rec ?? 0);
    let totalDespesasMes = 0;
    if (lancamentos > 0 && perfil.grupo_id) {
      // Só o próprio grupo da pessoa, para mostrar o resultado a ela mesma.
      const hoje = new Date();
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data: parcelas } = await db
        .from("parcelas")
        .select("valor")
        .eq("grupo_id", perfil.grupo_id)
        .gte("vencimento", ini)
        .lte("vencimento", fim)
        .limit(5000);
      totalDespesasMes = (parcelas ?? []).reduce((s: number, p: any) => s + Number(p.valor ?? 0), 0);
    }
    return { feito: lancamentos > 0, lancamentos, totalDespesasMes };
  });

/** Preferência de e-mails de retenção (resumo semanal e lembrete de vencimento) da própria conta. */
export const obterPreferenciaEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("profiles").select("emails_retencao").eq("id", context.userId).maybeSingle();
    return { ativo: data?.emails_retencao !== false };
  });

export const salvarPreferenciaEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ ativo: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("profiles").update({ emails_retencao: data.ativo }).eq("id", context.userId);
    return { ok: true };
  });
