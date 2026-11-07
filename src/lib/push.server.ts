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
  const prefs = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("preferencias_notificacao")
      .select("user_id,receber_todas,canal_push,silencio_ativo,silencio_inicio,silencio_fim,lembretes")
      .in("user_id", ids.slice(i, i + 200));
    if (error) return ids; // 42P01/PGRST205 (tabela pendente) ou outra falha: envia como antes
    for (const r of data ?? []) prefs.set(r.user_id, r);
  }
  const agoraMin = minutosAgoraBrasilia();
  return ids.filter((id) => {
    const p = prefs.get(id);
    if (!p) return true; // sem linha = padrões (tudo ligado, sem silêncio)
    if (p.receber_todas === false || p.canal_push === false) return false;
    if (opcoes.tipo && p.lembretes && typeof p.lembretes === "object" && p.lembretes[opcoes.tipo] === false) return false;
    if (!opcoes.urgente && p.silencio_ativo && dentroDoSilencio(p.silencio_inicio, p.silencio_fim, agoraMin)) return false;
    return true;
  });
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
