/**
 * Avisos na hora do evento (08/11/2026). A caixa é public.notificacoes_usuario: todo aviso gravado ali
 * dispara o gatilho do banco (pg_net) que chama /api/push/despachar, e o push sai na hora, respeitando
 * as preferências (tipo desligado, "Desligadas" ou "Só entre início e fim": fora da janela fica
 * 'agendado' e sai no início da janela). /api/cron/alertas (pg_cron de hora em hora + cron diário da
 * Vercel) gera os avisos de data e entrega os agendados.
 */
import { macroDe } from "@/lib/macro-categorias";
import { carregarPreferencias, decidirEnvio, diaBrasilia, enviarSemFiltro, minutosAgoraBrasilia } from "@/lib/push.server";

export type NovoAviso = {
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  /** Rota do app (o site traduz pelo tipo). */
  destino?: string | null;
  /** Anti-duplicidade por usuário. */
  chave?: string | null;
  /** Chave de lembrete das preferências (ex.: despesa_perto_vencer). */
  lembrete?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
};

const CAMPOS = "id,user_id,tipo,titulo,mensagem,destino,lembrete";
const DESTINO_POR_TIPO: Record<string, string> = {
  fatura: "/mais/cartoes",
  parcela: "/mais/despesas",
  garantia: "/notas",
  limite: "/mais/limites",
  open_finance: "/mais/pluggy",
  convite: "/mais/convites",
  regra_ciclo: "/mais/configuracoes",
};
/** Hora (Brasília) a partir da qual os avisos de data do dia são gerados (evita push de madrugada). */
const HORA_AVISOS_DE_DATA = 7;

/** Grava avisos (ignora os que já existem pela chave). O gatilho do banco manda o push. */
export async function gravarAvisos(db: any, avisos: NovoAviso[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < avisos.length; i += 500) {
    const lote = avisos.slice(i, i + 500).map((a) => ({
      ...a,
      destino: a.destino ?? DESTINO_POR_TIPO[a.tipo] ?? null,
      titulo: a.titulo.slice(0, 120),
      mensagem: a.mensagem.slice(0, 1000),
    }));
    const { data, error } = await db
      .from("notificacoes_usuario")
      .upsert(lote, { onConflict: "user_id,chave", ignoreDuplicates: true })
      .select("id");
    if (!error) n += (data ?? []).length;
  }
  return n;
}

async function marcar(db: any, ids: string[], campos: Record<string, unknown>) {
  for (let i = 0; i < ids.length; i += 300) await db.from("notificacoes_usuario").update(campos).in("id", ids.slice(i, i + 300));
}

/**
 * Entrega o push dos avisos pendentes (ids informados, ou todos) e dos agendados que chegaram na hora.
 * A troca para 'processando' é atômica: gatilho e cron juntos não mandam o mesmo aviso duas vezes.
 */
export async function despacharAvisos(db: any, ids?: string[]) {
  const agora = new Date();
  let q = db.from("notificacoes_usuario").update({ push_status: "processando" }).eq("push_status", "pendente");
  if (ids?.length) q = q.in("id", ids.slice(0, 500));
  const { data: pendentes, error } = await q.select(CAMPOS);
  if (error) return { enviados: 0, agendados: 0, ignorados: 0, erro: error.message };
  const { data: vencidos } = await db
    .from("notificacoes_usuario")
    .update({ push_status: "processando" })
    .eq("push_status", "agendado")
    .lte("push_agendado_para", agora.toISOString())
    .select(CAMPOS);
  const fila = [...(pendentes ?? []), ...(vencidos ?? [])] as any[];
  if (fila.length === 0) return { enviados: 0, agendados: 0, ignorados: 0 };

  const porUsuario = new Map<string, any[]>();
  for (const a of fila) porUsuario.set(a.user_id, [...(porUsuario.get(a.user_id) ?? []), a]);
  const prefs = (await carregarPreferencias(db, [...porUsuario.keys()])) ?? new Map();

  let enviados = 0;
  const ignorados: string[] = [];
  const feitos: string[] = [];
  const agendados = new Map<string, string[]>();
  for (const [uid, avisos] of porUsuario) {
    const p = prefs.get(uid);
    const liberados: any[] = [];
    for (const a of avisos) {
      const d = decidirEnvio(p, { tipo: a.lembrete ?? undefined }, agora);
      if (d.acao === "ignorar") ignorados.push(a.id);
      else if (d.acao === "agendar") {
        const k = d.para.toISOString();
        agendados.set(k, [...(agendados.get(k) ?? []), a.id]);
      } else liberados.push(a);
    }
    if (liberados.length === 0) continue;
    // Muitos de uma vez (ex.: entrega no início da janela): um resumo em vez de vários pushes.
    const mensagens =
      liberados.length > 3
        ? [{ titulo: `Você tem ${liberados.length} avisos novos`, corpo: liberados.slice(0, 3).map((a) => a.titulo).join(" · "), destino: "/mais/avisos" }]
        : liberados.map((a) => ({ titulo: a.titulo, corpo: a.mensagem, destino: a.destino ?? DESTINO_POR_TIPO[a.tipo] ?? "/mais/avisos" }));
    for (const m of mensagens) {
      const r = await enviarSemFiltro(db, [uid], m).catch(() => ({ enviados: 0, falhas: 1 }));
      enviados += r.enviados;
    }
    feitos.push(...liberados.map((a) => a.id));
  }
  await marcar(db, feitos, { push_status: "enviado", push_enviado_em: agora.toISOString() });
  await marcar(db, ignorados, { push_status: "ignorado" });
  let nAgendados = 0;
  for (const [para, lista] of agendados) {
    nAgendados += lista.length;
    await marcar(db, lista, { push_status: "agendado", push_agendado_para: para });
  }
  return { enviados, agendados: nAgendados, ignorados: ignorados.length };
}

async function membrosPorGrupo(db: any, grupos: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  for (let i = 0; i < grupos.length; i += 200) {
    const { data } = await db.from("profiles").select("id,grupo_id").in("grupo_id", grupos.slice(i, i + 200)).eq("ativo", true);
    for (const p of data ?? []) mapa.set(p.grupo_id, [...(mapa.get(p.grupo_id) ?? []), p.id]);
  }
  return mapa;
}

function diaDoMesEfetivo(iso: string, dia: number): number {
  const [a, m] = iso.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a!, m!, 0)).getUTCDate();
  return Math.min(Math.max(1, dia), ultimo);
}

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate.slice(0, 10)}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);

/** Avisos de data que entraram na janela: parcela vence hoje/amanhã, fatura fecha hoje ou vence, garantia acabando. */
export async function gerarAvisosDeData(db: any): Promise<number> {
  if (minutosAgoraBrasilia() < HORA_AVISOS_DE_DATA * 60) return 0;
  const hoje = diaBrasilia(0);
  const amanha = diaBrasilia(1);
  const em30 = diaBrasilia(30);
  const novos: (Omit<NovoAviso, "user_id"> & { grupo_id: string })[] = [];

  const { data: parcelas } = await db
    .from("parcelas")
    .select("id,vencimento,grupo_id,despesa:despesas(descricao,cartao_id,direcao)")
    .eq("paga", false)
    .gte("vencimento", hoje)
    .lte("vencimento", amanha)
    .not("grupo_id", "is", null)
    .limit(5000);
  for (const p of parcelas ?? []) {
    const d = Array.isArray(p.despesa) ? p.despesa[0] : p.despesa;
    if (!d || d.cartao_id || (d.direcao && d.direcao !== "debito")) continue; // compra no cartão: avisa pela fatura
    const venc = String(p.vencimento).slice(0, 10);
    novos.push({
      grupo_id: p.grupo_id,
      tipo: "parcela",
      titulo: venc === hoje ? "Parcela vence hoje" : "Parcela vence amanhã",
      mensagem: String(d.descricao ?? "Despesa"),
      chave: `parcela:${p.id}:${venc}`,
      lembrete: "despesa_perto_vencer",
      referencia_tipo: "parcela",
      referencia_id: p.id,
    });
  }

  const { data: cartoes } = await db
    .from("cartoes")
    .select("id,apelido,final,dia_fechamento,dia_vencimento,grupo_id")
    .not("grupo_id", "is", null)
    .limit(5000);
  const diaHoje = Number(hoje.slice(8, 10));
  const diaAmanha = Number(amanha.slice(8, 10));
  for (const c of cartoes ?? []) {
    const nome = c.apelido || (c.final ? `Cartão final ${c.final}` : "Cartão");
    if (c.dia_fechamento && diaDoMesEfetivo(hoje, Number(c.dia_fechamento)) === diaHoje)
      novos.push({ grupo_id: c.grupo_id, tipo: "fatura", titulo: "Fatura fecha hoje", mensagem: `${nome}: o fechamento da fatura é hoje.`, chave: `fatura:${c.id}:fecha:${hoje}`, lembrete: "revisar_faturas", referencia_tipo: "cartao", referencia_id: c.id });
    if (c.dia_vencimento) {
      const venceHoje = diaDoMesEfetivo(hoje, Number(c.dia_vencimento)) === diaHoje;
      const venceAmanha = diaDoMesEfetivo(amanha, Number(c.dia_vencimento)) === diaAmanha;
      if (venceHoje || venceAmanha) {
        const data = venceHoje ? hoje : amanha;
        novos.push({ grupo_id: c.grupo_id, tipo: "fatura", titulo: venceHoje ? "Fatura vence hoje" : "Fatura vence amanhã", mensagem: `${nome}: a fatura vence ${venceHoje ? "hoje" : "amanhã"}.`, chave: `fatura:${c.id}:venc:${data}`, lembrete: "despesa_perto_vencer", referencia_tipo: "cartao", referencia_id: c.id });
      }
    }
  }

  const { data: notas } = await db
    .from("notas_fiscais")
    .select("id,estabelecimento,descricao,garantia_fim,grupo_id,arquivada")
    .gte("garantia_fim", hoje)
    .lte("garantia_fim", em30)
    .not("grupo_id", "is", null)
    .limit(5000);
  for (const n of notas ?? []) {
    if (n.arquivada) continue;
    const dias = diasEntre(hoje, String(n.garantia_fim));
    const marco = dias <= 1 ? 1 : dias <= 7 ? 7 : 30;
    const nome = n.descricao || n.estabelecimento || "Produto";
    novos.push({
      grupo_id: n.grupo_id,
      tipo: "garantia",
      titulo: "Garantia acabando",
      mensagem: dias <= 0 ? `${nome}: a garantia acaba hoje.` : `${nome}: a garantia acaba em ${dias} dia${dias === 1 ? "" : "s"}.`,
      chave: `garantia:${n.id}:${String(n.garantia_fim).slice(0, 10)}:${marco}`,
      lembrete: "garantia_vencendo",
      referencia_tipo: "nota_fiscal",
      referencia_id: n.id,
    });
  }

  if (novos.length === 0) return 0;
  const membros = await membrosPorGrupo(db, [...new Set(novos.map((n) => n.grupo_id))]);
  const avisos: NovoAviso[] = [];
  for (const { grupo_id, ...a } of novos) for (const uid of membros.get(grupo_id) ?? []) avisos.push({ ...a, user_id: uid });
  return gravarAvisos(db, avisos);
}

const chaveTexto = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Limite perto do fim / estourado logo depois do lançamento (gatilho em parcelas).
 * Conta as parcelas de débito com vencimento no mês corrente (Brasília), categoria reduzida à macro
 * do limite. É a mesma regra do site sem as regras de fatura do ciclo: serve para o aviso, a tela
 * de limites continua sendo a referência do valor exato.
 */
export async function conferirLimites(db: any, grupos: string[]): Promise<number> {
  const lista = [...new Set(grupos.filter(Boolean))].slice(0, 100);
  if (lista.length === 0) return 0;
  const { data: limites } = await db.from("limites_gasto").select("id,grupo_id,categoria,valor_mensal,alerta_percentual,ativo").in("grupo_id", lista).eq("ativo", true);
  if (!limites?.length) return 0;
  const hoje = diaBrasilia(0);
  const mes = hoje.slice(0, 7);
  const [a, m] = mes.split("-").map(Number);
  const fim = `${mes}-${String(new Date(Date.UTC(a!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
  const gruposComLimite = [...new Set(limites.map((l: any) => l.grupo_id))] as string[];
  const { data: parcelas } = await db
    .from("parcelas")
    .select("valor,grupo_id,despesa:despesas(categoria,direcao)")
    .in("grupo_id", gruposComLimite)
    .gte("vencimento", `${mes}-01`)
    .lte("vencimento", fim)
    .limit(20000);
  const membros = await membrosPorGrupo(db, gruposComLimite);
  const avisos: NovoAviso[] = [];
  for (const g of gruposComLimite) {
    const doGrupo = limites.filter((l: any) => l.grupo_id === g);
    const macros = new Set<string>(doGrupo.map((l: any) => String(l.categoria)));
    const gasto = new Map<string, number>();
    for (const p of parcelas ?? []) {
      if (p.grupo_id !== g) continue;
      const d = Array.isArray(p.despesa) ? p.despesa[0] : p.despesa;
      if (!d || (d.direcao && d.direcao !== "debito")) continue;
      const k = chaveTexto(macroDe(d.categoria ?? null, macros));
      gasto.set(k, (gasto.get(k) ?? 0) + (Number(p.valor) || 0));
    }
    for (const l of doGrupo) {
      const valor = Number(l.valor_mensal) || 0;
      if (valor <= 0) continue;
      const perc = ((gasto.get(chaveTexto(String(l.categoria))) ?? 0) / valor) * 100;
      const status = perc > 100 ? "estourado" : perc >= (Number(l.alerta_percentual) || 80) ? "alerta" : null;
      if (!status) continue;
      for (const uid of membros.get(g) ?? [])
        avisos.push({
          user_id: uid,
          tipo: "limite",
          titulo: status === "estourado" ? `Limite de ${l.categoria} estourado` : `Limite de ${l.categoria} perto do fim`,
          mensagem: `${Math.round(perc)}% do limite do mês já foi usado.`,
          chave: `limite:${l.id}:${mes}:${status}`,
          lembrete: "limite_perto",
          referencia_tipo: "limite_gasto",
          referencia_id: l.id,
        });
    }
  }
  return avisos.length ? gravarAvisos(db, avisos) : 0;
}

/** Confere o segredo das chamadas do banco (pg_net) e dos crons. */
export function autorizado(request: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}
