import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, User, ZoomIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuthData";
import { cn } from "@/lib/utils";

/** Lado da imagem final, em pixels. Suficiente para telas retina no tamanho usado. */
const LADO_FINAL = 512;
const TAMANHO_ALVO = 300 * 1024;

/** Primeira letra do nome, para quando ainda não há foto. */
function inicial(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  return limpo ? limpo[0]!.toLocaleUpperCase("pt-BR") : "";
}

/**
 * Foto do usuário (2026-10-10).
 *
 * Ao escolher uma imagem, abre o ajuste: a pessoa arrasta e aproxima dentro do
 * círculo e confirma. A imagem é recortada e reduzida para 512px aqui no
 * navegador, então nunca aparece aviso de arquivo grande: uma foto de 8 MB vira
 * um arquivo de poucas dezenas de KB antes de subir.
 */
export function AvatarPerfil({
  tamanho = "size-9",
  permitirTroca = true,
  className,
}: {
  tamanho?: string;
  permitirTroca?: boolean;
  className?: string;
}) {
  const { user } = useSession();
  const { data: perfil } = useProfile();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [origem, setOrigem] = useState<string | null>(null);
  const foto = (perfil as { foto_url?: string | null } | undefined)?.foto_url ?? null;

  async function salvar(blob: Blob) {
    if (!user?.id) return;
    setEnviando(true);
    try {
      const caminho = `${user.id}/foto-${Date.now()}.jpg`;
      const { error: erroUpload } = await supabase.storage
        .from("avatares")
        .upload(caminho, blob, { upsert: true, contentType: "image/jpeg" });
      if (erroUpload) throw erroUpload;
      const { data: publico } = supabase.storage.from("avatares").getPublicUrl(caminho);
      const { error: erroPerfil } = await supabase
        .from("profiles")
        .update({ foto_url: publico.publicUrl } as never)
        .eq("id", user.id);
      if (erroPerfil) throw erroPerfil;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto atualizada.");
      setOrigem(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    setOrigem(URL.createObjectURL(arquivo));
    if (input.current) input.current.value = "";
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <Link
        to="/conta"
        aria-label="Abrir minha conta"
        title={perfil?.nome ? `${perfil.nome} — abrir minha conta` : "Abrir minha conta"}
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold text-muted-foreground transition-opacity hover:opacity-90",
          tamanho,
        )}
      >
        {foto ? (
          <img src={foto} alt="" className="size-full object-cover" />
        ) : inicial(perfil?.nome) ? (
          <span aria-hidden="true">{inicial(perfil?.nome)}</span>
        ) : (
          <User className="size-4" aria-hidden="true" />
        )}
      </Link>
      {permitirTroca && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={enviando}
            aria-label="Trocar foto do perfil"
            title="Trocar foto do perfil"
            className="absolute -bottom-1 -right-1 flex size-4.5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            {enviando ? (
              <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-2.5" aria-hidden="true" />
            )}
          </button>
          <AjusteFoto
            origem={origem}
            enviando={enviando}
            onCancelar={() => setOrigem(null)}
            onConfirmar={salvar}
          />
        </>
      )}
    </div>
  );
}

/** Recorte redondo com arrastar e aproximar, feito em canvas. */
function AjusteFoto({
  origem,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  origem: string | null;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: (blob: Blob) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const imagem = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  const [pronta, setPronta] = useState(false);
  const LADO = 260;

  useEffect(() => {
    if (!origem) {
      imagem.current = null;
      setPronta(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imagem.current = img;
      setZoom(1);
      setPos({ x: 0, y: 0 });
      setPronta(true);
    };
    img.onerror = () => toast.error("Não foi possível abrir esta imagem.");
    img.src = origem;
    return () => {
      URL.revokeObjectURL(origem);
    };
  }, [origem]);

  // Desenha a prévia sempre que a posição ou o zoom mudam.
  useEffect(() => {
    const c = canvas.current;
    const img = imagem.current;
    if (!c || !img || !pronta) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const base = Math.max(LADO / img.width, LADO / img.height);
    const escala = base * zoom;
    const largura = img.width * escala;
    const altura = img.height * escala;
    ctx.clearRect(0, 0, LADO, LADO);
    ctx.fillStyle = "#00000010";
    ctx.fillRect(0, 0, LADO, LADO);
    ctx.drawImage(img, (LADO - largura) / 2 + pos.x, (LADO - altura) / 2 + pos.y, largura, altura);
  }, [zoom, pos, pronta]);

  /** Gera o arquivo final já recortado e reduzido, buscando um tamanho pequeno. */
  async function gerar() {
    const img = imagem.current;
    if (!img) return;
    const saida = document.createElement("canvas");
    saida.width = LADO_FINAL;
    saida.height = LADO_FINAL;
    const ctx = saida.getContext("2d");
    if (!ctx) return;
    const proporcao = LADO_FINAL / LADO;
    const base = Math.max(LADO / img.width, LADO / img.height);
    const escala = base * zoom * proporcao;
    const largura = img.width * escala;
    const altura = img.height * escala;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LADO_FINAL, LADO_FINAL);
    ctx.drawImage(
      img,
      (LADO_FINAL - largura) / 2 + pos.x * proporcao,
      (LADO_FINAL - altura) / 2 + pos.y * proporcao,
      largura,
      altura,
    );
    // Reduz a qualidade até o arquivo ficar leve: nunca esbarra no limite.
    for (const qualidade of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((ok) => saida.toBlob(ok, "image/jpeg", qualidade));
      if (!blob) continue;
      if (blob.size <= TAMANHO_ALVO || qualidade === 0.4) {
        onConfirmar(blob);
        return;
      }
    }
  }

  return (
    <Dialog open={!!origem} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription>
            Arraste para posicionar e use a barra para aproximar. A imagem é reduzida antes de
            subir, então o tamanho do arquivo não importa.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <canvas
            ref={canvas}
            width={LADO}
            height={LADO}
            className="size-[260px] max-w-full cursor-grab touch-none rounded-full border active:cursor-grabbing"
            onPointerDown={(e) => {
              arrasto.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!arrasto.current) return;
              setPos({ x: e.clientX - arrasto.current.x, y: e.clientY - arrasto.current.y });
            }}
            onPointerUp={() => {
              arrasto.current = null;
            }}
          />
          <div className="flex w-full items-center gap-2">
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={([v]) => setZoom(v ?? 1)}
              aria-label="Aproximar a foto"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => void gerar()} disabled={enviando || !pronta}>
            {enviando ? "Enviando…" : "Usar esta foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
