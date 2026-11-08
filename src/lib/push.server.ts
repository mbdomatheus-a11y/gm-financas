/**
 * Envio de notificações push para o app iPhone e Android (01/11/2026), pelo serviço de push da Expo
 * (ele entrega pela Apple/APNs e pelo Google/FCM). Os tokens ficam em push_tokens (um por aparelho).
 * Opcional: EXPO_ACCESS_TOKEN na Vercel, se o "Enhanced push security" estiver ligado no projeto Expo.
 * Tokens que a Apple/Google dizem não existir mais (DeviceNotRegistered) são apagados.
 */
export type MensagemPush = { titulo: string; corpo: string; destino?: string };

/**
 * Opções do envio (07/11/2026, preferências de notificação). Tudo opcional: sem opções o envio
 * respeita só receber_todas, canal_push e o horário de silêncio.
 * - tipo: chave de lembrete (ex.: "despesa_perto_vencer"); se lembretes[tipo] === false, não envia.
 * - urgente: ignora o horário de silêncio (uso administrativo explícito). Nunca ignora quem desligou o push.
 */
export type OpcoesPush = { tipo?: string; urgente?: boolean };

export type ResultadoPush = { enviados: number; falhas: number; ignorados?: number };

const URL_EXPO = "https://exp.host/--/api/v2/push/send";

const minutosDe = (v: unknown): number | null => {
  if (typeof v !== "string") return null;
  const m = /^(\d{2}):(\d{2})/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Minutos desde a meia-noite no horário de Brasília. */
function minutosAgoraBrasilia(agora = new Date()): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return (h % 24) * 60 + m;
}

/** Data de hoje no horário de Brasília (YYYY-MM-DD), com deslocamento em dias. */
export function diaBrasilia(somaDias = 0, agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(agora.getTime() + somaDias * 86400000),
  );
}

export { minutosAgoraBrasilia };

export type DecisaoEnvio = { acao: "enviar" } | { acao: "ignorar" } | { acao: "agendar"; para: Date };

/**
 * Preferência de horário (08/11/2026): modo_horario "sempre" (padrão), "janela" (só entre
 * janela_inicio e janela_fim; fora disso guarda e entrega no início da janela) ou "desligado".
 * Linha antiga sem modo_horario (migration pendente) segue o "Não perturbe" (silencio_*).
 */
export function decidirEnvio(p: any, opcoes: OpcoesPush = {}, agora = new Date()): DecisaoEnvio {
  if (!p) return { acao: "enviar" };
  if (p.receber_todas === false || p.canal_push === false) return { acao: "ignorar" };
  if (opcoes.tipo && p.lembretes && typeof p.lembretes === "object" && p.lembretes[opcoes.tipo] === false)
    return { acao: "ignorar" };
  if (opcoes.urgente) return { acao: "enviar" };
  const agoraMin = minutosAgoraBrasilia(agora);
  const modo = typeof p.modo_horario === "string" ? p.modo_horario : null;
  if (modo === "desligado") return { acao: "ignorar" };
  if (modo === "janela") {
    const i = minutosDe(p.janela_inicio);
    const f = minutosDe(p.janela_fim);
    if (i === null || f === null || i === f) return { acao: "enviar" };
    const dentro = i < f ? agoraMin >= i && agoraMin < f : agoraMin >= i || agoraMin < f;
    if (dentro) return { acao: "enviar" };
    const delta = (i - agoraMin + 1440) % 1440;
    const para = new Date(agora.getTime() + delta * 60000);
    para.setSeconds(0, 0);
    return { acao: "agendar", para };
  }
  if (!modo && p.silencio_ativo && dentroDoSilencio(p.silencio_inicio, p.silencio_fim, agoraMin)) {
    const f = minutosDe(p.silencio_fim)!;
    const para = new Date(agora.getTime() + ((f - agoraMin + 1440) % 1440) * 60000);
    para.setSeconds(0, 0);
    return { acao: "agendar", para };
  }
  return { acao: "enviar" };
}

/** Preferências de vários usuários (select * tolera colunas novas ainda não criadas). */
export async function carregarPreferencias(db: any, ids: string[]): Promise<Map<string, any> | null> {
  const prefs = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("preferencias_notificacao").select("*").in("user_id", ids.slice(i, i + 200));
    if (error) return null;
    for (const r of data ?? []) prefs.set(r.user_id, r);
  }
  return prefs;
}

/** Está dentro do silêncio? Aceita intervalo que cruza a meia-noite (ex.: 22:00 a 08:00). */
export function dentroDoSilencio(inicio: unknown, fim: unknown, agoraMin = minutosAgoraBrasilia()): boolean {
  const i = minutosDe(inicio);
  const f = minutosDe(fim);
  if (i === null || f === null || i === f) return false;
  return i < f ? agoraMin >= i && agoraMin < f : agoraMin >= i || agoraMin < f;
}

/**
 * Filtra os usuários pelas preferências de notificação. Se a tabela ainda não existe
 * (migration pendente) ou a consulta falhar, devolve todos (comportamento anterior).
 */
async function filtrarPorPreferencias(db: any, ids: string[], opcoes: OpcoesPush): Promise<string[]> {
  const prefs = await carregarPreferencias(db, ids);
  if (!prefs) return ids; // 42P01/PGRST205 (tabela pendente) ou outra falha: envia como antes
  // Envio direto (admin): fora da janela não envia agora; avisos da caixa usam despacharAvisos (guarda e entrega depois).
  return ids.filter((id) => decidirEnvio(prefs.get(id), opcoes).acao === "enviar");
}

export async function enviarPush(
  db: any,
  userIds: string[],
  msg: MensagemPush,
  opcoes: OpcoesPush = {},
): Promise<ResultadoPush> {
  const todos = [...new Set(userIds.filter(Boolean))];
  if (todos.length === 0) return { enviados: 0, falhas: 0, ignorados: 0 };
  const ids = await filtrarPorPreferencias(db, todos, opcoes).catch(() => todos);
  const ignorados = todos.length - ids.length;
  if (ids.length === 0) return { enviados: 0, falhas: 0, ignorados };
  const r = await enviarSemFiltro(db, ids, msg);
  return { ...r, ignorados };
}

/** Envia para os aparelhos dos usuários, sem consultar preferências (quem chama já decidiu). */
export async function enviarSemFiltro(db: any, ids: string[], msg: MensagemPush): Promise<ResultadoPush> {
  const ignorados = 0;
  const tokens: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("push_tokens").select("token").in("user_id", ids.slice(i, i + 200));
    for (const t of data ?? []) tokens.push(t.token);
  }
  if (tokens.length === 0) return { enviados: 0, falhas: 0, ignorados };

  const cabecalhos: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const acesso = process.env["EXPO_ACCESS_TOKEN"];
  if (acesso) cabecalhos["Authorization"] = `Bearer ${acesso}`;

  let enviados = 0;
  let falhas = 0;
  const invalidos: string[] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const lote = tokens.slice(i, i + 100);
    try {
      const res = await fetch(URL_EXPO, {
        signal: AbortSignal.timeout(10000),
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify(
          lote.map((to) => ({
            to,
            title: msg.titulo.slice(0, 120),
            body: msg.corpo.slice(0, 400),
            sound: "default",
            channelId: "avisos",
            data: msg.destino ? { destino: msg.destino } : {},
          })),
        ),
      });
      const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
      (json?.data ?? []).forEach((r, k) => {
        if (r.status === "ok") enviados++;
        else {
          falhas++;
          if (r.details?.error === "DeviceNotRegistered") invalidos.push(lote[k]!);
        }
      });
      if (!json?.data) falhas += lote.length;
    } catch {
      falhas += lote.length;
    }
  }
  if (invalidos.length) await db.from("push_tokens").delete().in("token", invalidos);
  return { enviados, falhas, ignorados };
}
