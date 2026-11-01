/**
 * Envio de notificações push para o app iPhone e Android (01/11/2026), pelo serviço de push da Expo
 * (ele entrega pela Apple/APNs e pelo Google/FCM). Os tokens ficam em push_tokens (um por aparelho).
 * Opcional: EXPO_ACCESS_TOKEN na Vercel, se o "Enhanced push security" estiver ligado no projeto Expo.
 * Tokens que a Apple/Google dizem não existir mais (DeviceNotRegistered) são apagados.
 */
export type MensagemPush = { titulo: string; corpo: string; destino?: string };

const URL_EXPO = "https://exp.host/--/api/v2/push/send";

export async function enviarPush(db: any, userIds: string[], msg: MensagemPush): Promise<{ enviados: number; falhas: number }> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return { enviados: 0, falhas: 0 };
  const tokens: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("push_tokens").select("token").in("user_id", ids.slice(i, i + 200));
    for (const t of data ?? []) tokens.push(t.token);
  }
  if (tokens.length === 0) return { enviados: 0, falhas: 0 };

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
  return { enviados, falhas };
}
