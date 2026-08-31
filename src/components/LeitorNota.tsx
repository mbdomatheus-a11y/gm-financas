import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extrairChave } from "@/lib/nfe";

type ControlsLike = { stop: () => void };

export function LeitorNota({
  open,
  onOpenChange,
  onLido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLido: (payload: { chave: string; texto: string }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ControlsLike | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current!,
          (result) => {
            if (cancelado || !result) return;
            const texto = result.getText();
            const chave = extrairChave(texto);
            if (!chave) return;
            controls.stop();
            onLido({ chave, texto });
          },
        );
        if (cancelado) controls.stop();
        else controlsRef.current = controls;
      } catch {
        if (!cancelado) setErro("Não foi possível abrir a câmera. Digite a chave manualmente.");
      }
    })();

    return () => {
      cancelado = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onLido]);

  function usarManual() {
    const chave = extrairChave(manual);
    if (!chave) {
      setErro("Informe a chave de acesso com 44 dígitos ou o link da nota.");
      return;
    }
    onLido({ chave, texto: manual });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-4.5" /> Ler nota fiscal
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border bg-muted">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        </div>
        <p className="text-xs text-muted-foreground">
          Aponte para o QR Code ou o código de barras da nota fiscal.
        </p>

        <div className="space-y-2">
          <Label htmlFor="chave-manual">Ou informe a chave / link</Label>
          <div className="flex gap-2">
            <Input
              id="chave-manual"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="44 dígitos"
              inputMode="numeric"
            />
            <Button type="button" onClick={usarManual}>
              Usar
            </Button>
          </div>
        </div>

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <Button variant="ghost" className="gap-2" onClick={() => onOpenChange(false)}>
          <X className="size-4" /> Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
