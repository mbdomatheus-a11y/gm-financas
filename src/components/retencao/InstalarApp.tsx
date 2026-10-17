import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rastrearEvento } from "@/lib/funil-cliente";

/**
 * Instalar o site na tela inicial do celular (2026-10-17, plano de retenção).
 * Android/Chrome: usa o convite nativo (beforeinstallprompt). iPhone: o Safari não tem
 * convite, então mostramos o caminho (Compartilhar > Adicionar à Tela de Início).
 */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let eventoGuardado: EventoInstalar | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoGuardado = e as EventoInstalar;
  });
}

const CHAVE_DISPENSA = "control-all.instalar-dispensado-em";

function jaInstalado() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function useInstalarApp() {
  const [pronto, setPronto] = useState<"android" | "ios" | null>(null);
  useEffect(() => {
    if (jaInstalado()) return;
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|instagram|fban|fbav/i.test(ua);
    if (ios) return setPronto("ios");
    if (eventoGuardado) return setPronto("android");
    const ouvir = () => setPronto("android");
    window.addEventListener("beforeinstallprompt", ouvir);
    return () => window.removeEventListener("beforeinstallprompt", ouvir);
  }, []);
  async function instalar() {
    rastrearEvento("instalar_app_clique");
    if (!eventoGuardado) return false;
    await eventoGuardado.prompt();
    eventoGuardado = null;
    setPronto(null);
    return true;
  }
  return { disponivel: pronto, instalar };
}

/** Cartão discreto: some ao dispensar e só volta depois de 14 dias. */
export function InstalarAppCartao({ forcar = false, className = "" }: { forcar?: boolean; className?: string }) {
  const { disponivel, instalar } = useInstalarApp();
  const [dispensado, setDispensado] = useState(true);
  const [dicaIos, setDicaIos] = useState(false);
  useEffect(() => {
    try {
      const em = Number(localStorage.getItem(CHAVE_DISPENSA) ?? 0);
      setDispensado(!forcar && Date.now() - em < 14 * 86_400_000);
    } catch {
      setDispensado(false);
    }
  }, [forcar]);
  if (!disponivel || dispensado) return null;
  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE_DISPENSA, String(Date.now()));
    } catch {
      /* ignora */
    }
    setDispensado(true);
  };
  return (
    <div className={`relative flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 pr-9 ${className}`}>
      <Download className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0 space-y-2 text-sm">
        <p className="font-semibold">Tenha o Control ALL na tela inicial</p>
        <p className="text-xs text-muted-foreground">Abre como um aplicativo, sem loja e sem ocupar espaço.</p>
        {disponivel === "android" && (
          <Button size="sm" onClick={() => void instalar()}>
            Adicionar à tela inicial
          </Button>
        )}
        {disponivel === "ios" &&
          (dicaIos ? (
            <p className="flex flex-wrap items-center gap-1 text-xs">
              Toque em <Share className="inline size-3.5" /> <b>Compartilhar</b> na barra do Safari e depois em
              <b>Adicionar à Tela de Início</b>.
            </p>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                rastrearEvento("instalar_app_clique");
                setDicaIos(true);
              }}
            >
              Como adicionar
            </Button>
          ))}
      </div>
      <button type="button" onClick={dispensar} aria-label="Dispensar" className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted">
        <X className="size-4" />
      </button>
    </div>
  );
}
