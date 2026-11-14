import { useState } from "react";
import { Download, Image as ImageIcon, MessageCircle, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { formatBRL } from "@/lib/format";

/** Desenha título + linhas num canvas (mesmo visual do antigo Compartilhar). */
function desenhar(titulo: string, linhas: string[]): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const W = (canvas.width = 1080);
  const linhaAltura = 54;
  const H = (canvas.height = Math.max(600, 260 + linhas.length * linhaAltura + 120));
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px system-ui, sans-serif";
  ctx.fillText(titulo, 80, 140, W - 160);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(80, 200, W - 160, H - 300, 24);
  ctx.fill();
  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  let y = 260;
  for (const l of linhas) {
    ctx.fillText(l, 120, y, W - 240);
    y += linhaAltura;
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "400 24px system-ui, sans-serif";
  ctx.fillText("Gerado pelo Control ALL", 80, H - 50);
  return canvas;
}

type Nav = Navigator & { canShare?: (d: ShareData) => boolean };

/**
 * Botão discreto (ícone) de compartilhar dentro das telas. `gerar` monta as linhas do resumo e recebe
 * `fmt` para formatar dinheiro: com o olho fechado, o menu oferece compartilhar sem valores (padrão).
 */
export function BotaoCompartilhar({
  titulo,
  arquivo,
  gerar,
  temValores = true,
  desativado = false,
  className,
}: {
  titulo: string;
  arquivo: string;
  gerar: (fmt: (n: number) => string) => string[];
  temValores?: boolean;
  desativado?: boolean;
  className?: string;
}) {
  const { ocultarValores } = usePrivacidadeValores();
  const [incluir, setIncluir] = useState(false);
  const comValores = temValores ? !ocultarValores || incluir : true;

  const montar = () => {
    const fmt = (n: number) => (comValores ? formatBRL(n) : "R$ •••");
    const linhas = gerar(fmt).filter((l) => l.trim().length > 0);
    return { linhas, texto: `${titulo}\n\n${linhas.join("\n")}\n\nControl ALL` };
  };

  const whats = (texto: string) => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");

  const imagem = (acao: "compartilhar" | "baixar") => {
    const { linhas, texto } = montar();
    const canvas = desenhar(titulo, linhas);
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (acao === "baixar") {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${arquivo}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast.success("Imagem baixada");
        return;
      }
      const file = new File([blob], `${arquivo}.png`, { type: "image/png" });
      if ((navigator as Nav).canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: titulo });
          return;
        } catch {
          return; // cancelado
        }
      }
      whats(texto);
    }, "image/png");
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(montar().texto);
      toast.success("Texto copiado");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className ?? "size-8 rounded-full text-muted-foreground"} aria-label={`Compartilhar: ${titulo}`} disabled={desativado}>
          <Share2 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {temValores && ocultarValores && (
          <>
            <DropdownMenuCheckboxItem checked={incluir} onCheckedChange={(v) => setIncluir(!!v)} onSelect={(e) => e.preventDefault()}>
              Incluir valores (estão ocultos)
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => imagem("compartilhar")}>
          <ImageIcon className="size-4" /> Compartilhar imagem
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => whats(montar().texto)}>
          <MessageCircle className="size-4" /> Enviar texto no WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copiar}>
          <Copy className="size-4" /> Copiar texto
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => imagem("baixar")}>
          <Download className="size-4" /> Baixar imagem
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
