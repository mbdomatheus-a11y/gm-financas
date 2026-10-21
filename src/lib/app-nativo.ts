/**
 * Ponte com o app iOS (Capacitor + MainViewController.swift). No navegador tudo aqui é inerte:
 * a classe `native-app` e os `messageHandlers` só existem dentro do app.
 */
type Ponte = { postMessage: (mensagem: unknown) => void };
type NomePonte = "agendaApp" | "authApp" | "notificacoesApp";

/** Está rodando dentro do app do iPhone? */
export function ehAppNativo(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("native-app");
}

/** Canal de mensagens com o app nativo (null no navegador ou em versões antigas do app). */
export function ponteNativa(nome: NomePonte): Ponte | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { webkit?: { messageHandlers?: Partial<Record<NomePonte, Ponte>> } };
  return w.webkit?.messageHandlers?.[nome] ?? null;
}

/** Lembrete que vira notificação na tela de bloqueio do iPhone. */
export type LembreteApp = {
  id: string;
  titulo: string;
  corpo: string;
  /** Data e hora locais no formato YYYY-MM-DDTHH:mm. */
  quando: string;
  destino: string;
};

const p2 = (n: number) => String(n).padStart(2, "0");

function formatarLocal(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "YYYY-MM-DD" (ou Date) → horário local do lembrete, opcionalmente alguns dias antes. */
export function momentoLembrete(data: string | Date, hora = 9, diasAntes = 0): string {
  const base =
    typeof data === "string"
      ? (() => {
          const [a, m, d] = data.slice(0, 10).split("-").map(Number);
          return new Date(a!, m! - 1, d!);
        })()
      : new Date(data.getFullYear(), data.getMonth(), data.getDate());
  return formatarLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate() - diasAntes, hora, 0));
}

let ultimoEnvio = "";

/**
 * Agenda no iPhone os lembretes futuros (o iOS aceita até 64 pendentes; mandamos os 60 mais próximos).
 * Só reenvia quando a lista muda, para não reagendar tudo a cada atualização dos alertas.
 */
export function agendarLembretesNoApp(itens: LembreteApp[]): void {
  const ponte = ponteNativa("notificacoesApp");
  if (!ponte) return;
  const agora = formatarLocal(new Date());
  const proximos = itens
    .filter((i) => i.quando > agora)
    .sort((a, b) => a.quando.localeCompare(b.quando))
    .slice(0, 60);
  const assinatura = JSON.stringify(proximos);
  if (assinatura === ultimoEnvio) return;
  ultimoEnvio = assinatura;
  ponte.postMessage({ acao: "agendar", itens: proximos });
}
