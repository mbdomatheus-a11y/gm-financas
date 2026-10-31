/**
 * E-mails de retenção (2026-10-17, plano de retenção). Rodam dentro do cron diário
 * (/api/cron/descarte-layouts), para não criar outro agendamento na Vercel:
 * - todo dia: lembrete de parcelas que vencem daqui a 3 dias (soma por data);
 * - segunda-feira: resumo da semana; para quem ainda não lançou nada nas 3 primeiras
 *   semanas, um convite curto para o 1º lançamento.
 * Cada envio fica em `emails_retencao_log` (único por pessoa, tipo e referência), então
 * rodar duas vezes no mesmo dia não duplica e-mail. Quem desativa (link no rodapé ou na
 * tela Conta) tem `profiles.emails_retencao = false`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { enviarEmail, obterUrlBaseSite } from "@/lib/email.server";
import { lancamentosPorCompetencias, receitasPorCompetencias } from "@/lib/recorrencia";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function segredo(): string {
  return process.env["EMAIL_LINK_SECRET"] || process.env["CRON_SECRET"] || "";
}

export function tokenCancelamento(userId: string): string {
  return createHmac("sha256", segredo()).update(`parar-emails:${userId}`).digest("hex").slice(0, 32);
}

export function tokenCancelamentoValido(userId: string, token: string): boolean {
  if (!segredo() || !token) return false;
  const a = Buffer.from(tokenCancelamento(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function moldura(titulo: string, corpo: string, userId: string): string {
  const base = obterUrlBaseSite();
  const parar = `${base}/api/email/parar?u=${userId}&t=${tokenCancelamento(userId)}`;
  return `<!doctype html><html><body style="margin:0;background:#f3f6f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 16px;font-weight:bold;color:#2f5f95;font-size:18px">Control ALL</p>
<div style="background:#ffffff;border-radius:14px;padding:22px;border:1px solid #e5e7eb">
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${titulo}</h1>
${corpo}
</div>
<p style="margin:16px 0 0;font-size:11px;color:#6b7280;line-height:1.5">Você recebe este e-mail porque tem uma conta no Control ALL.
<a href="${parar}" style="color:#6b7280">Não quero mais receber estes avisos</a>.</p>
</div></body></html>`;
}

function botao(texto: string, caminho: string): string {
  return `<p style="margin:20px 0 4px"><a href="${obterUrlBaseSite()}${caminho}" style="display:inline-block;background:#2f5f95;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">${texto}</a></p>`;
}

function linha(rotulo: string, valor: string): string {
  return `<tr><td style="padding:6px 0;color:#4b5563">${rotulo}</td><td style="padding:6px 0;text-align:right;font-weight:bold">${valor}</td></tr>`;
}

type Perfil = { id: string; nome: string | null; email: string | null; grupo_id: string | null; created_at: string };

async function jaEnviado(db: any, userId: string, tipo: string, referencia: string) {
  const { data } = await db
    .from("emails_retencao_log")
    .select("id")
    .eq("user_id", userId)
    .eq("tipo", tipo)
    .eq("referencia", referencia)
    .maybeSingle();
  return !!data;
}

async function registrar(db: any, userId: string, tipo: string, referencia: string) {
  await db.from("emails_retencao_log").insert({ user_id: userId, tipo, referencia });
}

async function perfisAtivos(db: any): Promise<Perfil[]> {
  const { data } = await db
    .from("profiles")
    .select("id,nome,email,grupo_id,created_at")
    .eq("ativo", true)
    .eq("emails_retencao", true)
    .not("email", "is", null)
    .limit(5000);
  return (data ?? []).filter((p: Perfil) => p.email && /@/.test(p.email));
}

async function fezPrimeiroLancamento(db: any, p: Perfil): Promise<boolean> {
  const limite = new Date(new Date(p.created_at).getTime() + 10 * 60_000).toISOString();
  const [{ count: d }, { count: l }, { count: r }] = await Promise.all([
    db.from("despesas").select("id", { count: "exact", head: true }).eq("created_by", p.id),
    db.from("import_lotes").select("id", { count: "exact", head: true }).eq("created_by", p.id),
    db.from("receitas").select("id", { count: "exact", head: true }).eq("created_by", p.id).gte("created_at", limite),
  ]);
  return (d ?? 0) + (l ?? 0) + (r ?? 0) > 0;
}

/** Lembrete diário: parcelas em aberto que vencem daqui a 3 dias. */
export async function enviarLembretesVencimento(db: any, hoje = new Date()): Promise<number> {
  const alvo = new Date(hoje);
  alvo.setDate(alvo.getDate() + 3);
  const dia = isoDia(alvo);
  let enviados = 0;
  const perfis = await perfisAtivos(db);
  const porGrupo = new Map<string, { total: number; itens: number }>();
  for (const p of perfis) {
    if (!p.grupo_id || porGrupo.has(p.grupo_id)) continue;
    const { data } = await db
      .from("parcelas")
      .select("valor")
      .eq("grupo_id", p.grupo_id)
      .eq("paga", false)
      .eq("vencimento", dia)
      .limit(2000);
    porGrupo.set(p.grupo_id, {
      total: (data ?? []).reduce((s: number, x: any) => s + Number(x.valor ?? 0), 0),
      itens: data?.length ?? 0,
    });
  }
  for (const p of perfis) {
    const g = p.grupo_id ? porGrupo.get(p.grupo_id) : null;
    if (!g || g.itens === 0 || g.total <= 0) continue;
    if (await jaEnviado(db, p.id, "vencimento", dia)) continue;
    const nome = (p.nome ?? "").split(" ")[0] || "Olá";
    const html = moldura(
      `${nome}, ${brl(g.total)} vencem em ${dataBR(dia)}`,
      `<p style="margin:0;line-height:1.6">São ${g.itens} ${g.itens === 1 ? "lançamento em aberto" : "lançamentos em aberto"} com vencimento em ${dataBR(dia)}. Confira se a conta ou fatura já está separada.</p>${botao("Ver vencimentos", "/calendario")}`,
      p.id,
    );
    const r = await enviarEmail({ to: p.email!, subject: `Vence em 3 dias: ${brl(g.total)}`, html });
    if (r.ok) {
      await registrar(db, p.id, "vencimento", dia);
      enviados++;
    }
    await esperar(600);
  }
  return enviados;
}

/** Resumo semanal (segunda-feira) ou convite ao 1º lançamento. */
export async function enviarResumosSemanais(db: any, hoje = new Date()): Promise<number> {
  const semana = isoDia(hoje);
  const ini7 = new Date(hoje);
  ini7.setDate(ini7.getDate() - 7);
  const fim7 = new Date(hoje);
  fim7.setDate(fim7.getDate() + 7);
  const iniMes = isoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const fimMes = isoDia(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  let enviados = 0;
  const cacheGrupo = new Map<string, any>();

  for (const p of await perfisAtivos(db)) {
    if (await jaEnviado(db, p.id, "semanal", semana)) continue;
    const nome = (p.nome ?? "").split(" ")[0] || "Olá";
    let assunto: string;
    let html: string;

    if (!(await fezPrimeiroLancamento(db, p))) {
      const semanasDeConta = (hoje.getTime() - new Date(p.created_at).getTime()) / (7 * 86_400_000);
      if (semanasDeConta > 3) continue; // não insiste com quem nunca começou
      assunto = "Seu primeiro passo leva 1 minuto";
      html = moldura(
        `${nome}, falta só o primeiro gasto`,
        `<p style="margin:0 0 10px;line-height:1.6">Fale ou digite um gasto, por exemplo <i>"mercado, 85 reais no cartão"</i>, e a IA monta o lançamento para você conferir.</p>
<p style="margin:0;line-height:1.6">Ou envie o PDF da fatura do cartão: você vê todas as compras e em que mês cada parcela termina.</p>${botao("Fazer meu primeiro lançamento", "/inicio")}`,
        p.id,
      );
    } else {
      if (!p.grupo_id) continue;
      let g = cacheGrupo.get(p.grupo_id);
      if (!g) {
        const [{ data: semanaDesp }, { data: proximas }, { data: mes }] = await Promise.all([
          db
            .from("despesas")
            .select("valor_total,categoria,direcao")
            .eq("grupo_id", p.grupo_id)
            .gte("data_compra", isoDia(ini7))
            .lt("data_compra", semana)
            .limit(5000),
          db
            .from("parcelas")
            .select("valor")
            .eq("grupo_id", p.grupo_id)
            .eq("paga", false)
            .gte("vencimento", semana)
            .lte("vencimento", isoDia(fim7))
            .limit(5000),
          db
            .from("parcelas")
            .select("numero,total")
            .eq("grupo_id", p.grupo_id)
            .gte("vencimento", iniMes)
            .lte("vencimento", fimMes)
            .limit(5000),
        ]);
        const gastos = (semanaDesp ?? []).filter((d: any) => d.direcao !== "credito");
        const porCat = new Map<string, number>();
        for (const d of gastos) porCat.set(d.categoria || "Sem categoria", (porCat.get(d.categoria || "Sem categoria") ?? 0) + Number(d.valor_total ?? 0));
        const maior = [...porCat.entries()].sort((a, b) => b[1] - a[1])[0];
        const saldo = await saldoDoMes(db, p.grupo_id, iniMes.slice(0, 7));
        g = {
          saldo,
          totalSemana: gastos.reduce((s: number, d: any) => s + Number(d.valor_total ?? 0), 0),
          qtdSemana: gastos.length,
          maior,
          aVencer: (proximas ?? []).reduce((s: number, x: any) => s + Number(x.valor ?? 0), 0),
          terminam: (mes ?? []).filter((x: any) => x.total > 1 && x.numero === x.total).length,
        };
        cacheGrupo.set(p.grupo_id, g);
      }
      // 31/10/2026: o resumo também mostra o saldo previsto do mês (motivo para voltar).
      const temSaldo = !!g.saldo && (g.saldo.receitas > 0 || g.saldo.despesas > 0);
      if (g.qtdSemana === 0 && g.aVencer === 0 && !temSaldo) continue; // nada a contar esta semana
      assunto = g.qtdSemana > 0 ? `Sua semana: ${brl(g.totalSemana)} em gastos` : `A vencer nesta semana: ${brl(g.aVencer)}`;
      html = moldura(
        `${nome}, seu resumo da semana`,
        `<table style="width:100%;border-collapse:collapse;font-size:14px">
${temSaldo ? linha("Saldo previsto do mês", brl(g.saldo.receitas - g.saldo.despesas)) : ""}
${temSaldo ? linha("Receitas do mês / despesas do mês", `${brl(g.saldo.receitas)} / ${brl(g.saldo.despesas)}`) : ""}
${linha("Gastos lançados nos últimos 7 dias", `${brl(g.totalSemana)} (${g.qtdSemana})`)}
${g.maior ? linha("Maior categoria", `${g.maior[0]}: ${brl(g.maior[1])}`) : ""}
${linha("A vencer nos próximos 7 dias", brl(g.aVencer))}
${g.terminam > 0 ? linha("Parcelamentos que terminam este mês", String(g.terminam)) : ""}
</table>${botao("Ver meu mês", "/dashboard")}`,
        p.id,
      );
    }
    const r = await enviarEmail({ to: p.email!, subject: assunto, html });
    if (r.ok) {
      await registrar(db, p.id, "semanal", semana);
      enviados++;
    }
    await esperar(600);
  }
  return enviados;
}

/**
 * Ativação no dia 1 e no dia 3 (31/10/2026, análise de retenção: só 4 de 16 fizeram o 1º lançamento).
 * Para quem criou a conta e ainda não lançou nada. Cada um vai uma vez só (tipo "ativacao", referência d1/d3).
 */
export async function enviarAtivacao(db: any, hoje = new Date()): Promise<number> {
  let enviados = 0;
  for (const p of await perfisAtivos(db)) {
    const dias = Math.floor((hoje.getTime() - new Date(p.created_at).getTime()) / 86_400_000);
    const ref = dias === 1 ? "d1" : dias === 3 ? "d3" : null;
    if (!ref) continue;
    if (await jaEnviado(db, p.id, "ativacao", ref)) continue;
    if (await fezPrimeiroLancamento(db, p)) continue;
    const nome = (p.nome ?? "").split(" ")[0] || "Olá";
    const assunto =
      ref === "d1" ? "Faltam 30 segundos para ver para onde vai seu dinheiro" : `${nome}, seu controle ainda está vazio`;
    const corpo =
      ref === "d1"
        ? `<p style="margin:0 0 10px;line-height:1.6">Ontem você criou sua conta no Control ALL. Falta só o primeiro gasto: digite ou fale algo como <i>"mercado, 85 reais"</i> e pronto.</p>
<p style="margin:0;line-height:1.6">É grátis e você confere tudo antes de salvar.</p>${botao("Lançar meu primeiro gasto", "/inicio")}`
        : `<p style="margin:0 0 10px;line-height:1.6">Um jeito rápido de começar: envie o PDF da fatura do cartão. Você vê todas as compras separadas por categoria e em que mês cada parcela termina.</p>
<p style="margin:0;line-height:1.6">Prefere à mão? Um gasto já mostra o resumo do mês.</p>${botao("Enviar a fatura do cartão", "/importar")}`;
    const r = await enviarEmail({ to: p.email!, subject: assunto, html: moldura(ref === "d1" ? `${nome}, falta só 1 passo` : "Comece pela fatura do cartão", corpo, p.id) });
    if (r.ok) {
      await registrar(db, p.id, "ativacao", ref);
      enviados++;
    }
    await esperar(600);
  }
  return enviados;
}

/** Saldo previsto do mês do grupo (receitas menos despesas, mesma regra de competência do site). */
async function saldoDoMes(db: any, grupoId: string, mes: string): Promise<{ receitas: number; despesas: number } | null> {
  try {
    const [{ data: despesas }, { data: receitas }] = await Promise.all([
      db.from("despesas").select("*, parcelas(*)").eq("grupo_id", grupoId).limit(10000),
      db.from("receitas").select("*").eq("grupo_id", grupoId).limit(5000),
    ]);
    const emReal = (v: number, moeda?: string | null) => (moeda && moeda !== "BRL" ? v * 5.4 : v);
    const desp = lancamentosPorCompetencias(despesas ?? [], [mes]).reduce(
      (s: number, l: any) => s + emReal(Number(l.valor) || 0, l.moeda),
      0,
    );
    const rec = receitasPorCompetencias(receitas ?? [], [mes]).reduce(
      (s: number, r: any) => s + emReal(Number(r.valor) || 0, r.moeda),
      0,
    );
    return { receitas: rec, despesas: desp };
  } catch {
    return null;
  }
}

/** Chamado pelo cron diário. Horário do Brasil para decidir se é segunda-feira. */
export async function rodarEmailsRetencao(db: any): Promise<{ lembretes: number; ativacao: number; semanais: number }> {
  const agoraBR = new Date(Date.now() - 3 * 3_600_000);
  const lembretes = await enviarLembretesVencimento(db, agoraBR).catch(() => 0);
  const ativacao = await enviarAtivacao(db, agoraBR).catch(() => 0);
  const semanais = agoraBR.getUTCDay() === 1 ? await enviarResumosSemanais(db, agoraBR).catch(() => 0) : 0;
  return { lembretes, ativacao, semanais };
}
