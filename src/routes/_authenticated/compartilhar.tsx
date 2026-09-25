import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Share2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDespesas, useReceitas } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { useProfile } from "@/hooks/useAuthData";
import { currentMonthKey, formatBRL, monthKey, monthLabel, toBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/compartilhar")({
  head: () => ({
    meta: [
      { title: "Compartilhar resumo — Control ALL" },
      {
        name: "description",
        content:
          "Gere uma imagem do resumo financeiro do mês para compartilhar no WhatsApp ou salvar.",
      },
      { property: "og:title", content: "Compartilhar resumo — Control ALL" },
      {
        property: "og:description",
        content: "Resumo mensal do casal em imagem pronta para compartilhar.",
      },
    ],
  }),
  component: CompartilharPage,
});

function CompartilharPage() {
  const cotacao = useCotacao();
  const { data: perfil } = useProfile();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mes, setMes] = useState(currentMonthKey());

  const meses = useMemo(() => {
    const set = new Set<string>([currentMonthKey()]);
    receitas.forEach((r: any) => set.add(monthKey(r.data_recebimento)));
    despesas.forEach((d: any) => set.add(monthKey(d.data_compra)));
    return [...set].sort().reverse();
  }, [receitas, despesas]);

  const resumo = useMemo(() => {
    const rec = receitas
      .filter((r: any) => monthKey(r.data_recebimento) === mes)
      .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);

    const parcelasMes = despesas.flatMap((d: any) =>
      (d.parcelas ?? [])
        .filter((p: any) => monthKey(p.vencimento) === mes)
        .map((p: any) => ({ ...p, categoria: d.categoria, moeda: d.moeda })),
    );
    const desp = parcelasMes.reduce(
      (s: number, p: any) => s + toBRL(Number(p.valor), p.moeda, cotacao),
      0,
    );
    const porCategoria = Object.entries(
      parcelasMes.reduce((acc: Record<string, number>, p: any) => {
        acc[p.categoria] = (acc[p.categoria] ?? 0) + toBRL(Number(p.valor), p.moeda, cotacao);
        return acc;
      }, {}),
    )
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5) as [string, number][];

    return { rec, desp, saldo: rec - desp, porCategoria };
  }, [receitas, despesas, mes, cotacao]);

  function desenhar(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const W = (canvas.width = 1080);
    const H = (canvas.height = 1350);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.fillText("Resumo financeiro do casal", 80, 140);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 84px system-ui, sans-serif";
    ctx.fillText(monthLabel(mes).toUpperCase(), 80, 240);

    const box = (y: number, label: string, value: string, color: string) => {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.roundRect(80, y, W - 160, 150, 28);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "500 30px system-ui, sans-serif";
      ctx.fillText(label, 120, y + 58);
      ctx.fillStyle = color;
      ctx.font = "800 56px system-ui, sans-serif";
      ctx.fillText(value, 120, y + 118);
    };

    box(320, "Receitas do mês", formatBRL(resumo.rec), "#4ade80");
    box(500, "Despesas do mês", formatBRL(resumo.desp), "#f87171");
    box(680, "Saldo", formatBRL(resumo.saldo), resumo.saldo >= 0 ? "#38bdf8" : "#fbbf24");

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 32px system-ui, sans-serif";
    ctx.fillText("Maiores categorias", 80, 900);

    let y = 960;
    resumo.porCategoria.forEach(([cat, val]) => {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "500 30px system-ui, sans-serif";
      ctx.fillText(cat, 80, y);
      ctx.textAlign = "right";
      ctx.fillText(formatBRL(val), W - 80, y);
      ctx.textAlign = "left";
      y += 60;
    });

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "400 26px system-ui, sans-serif";
    ctx.fillText(`Gerado por ${perfil?.nome ?? "Control ALL"}`, 80, H - 80);

    return canvas;
  }

  async function baixar() {
    const canvas = desenhar();
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumo-${mes}.png`;
    a.click();
    toast.success("Imagem baixada");
  }

  async function compartilhar() {
    const canvas = desenhar();
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `resumo-${mes}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Resumo ${monthLabel(mes)}` });
        } catch {
          /* cancelado pelo usuário */
        }
      } else {
        const texto = `Resumo ${monthLabel(mes)}%0AReceitas: ${formatBRL(resumo.rec)}%0ADespesas: ${formatBRL(resumo.desp)}%0ASaldo: ${formatBRL(resumo.saldo)}`;
        window.open(`https://wa.me/?text=${texto}`, "_blank", "noopener");
      }
    }, "image/png");
  }

  async function copiarParaClipboard() {
    const canvas = desenhar();
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          toast.success("Imagem copiada para a área de transferência! Cole no WhatsApp.");
        } else {
          toast.error("Seu navegador não suporta copiar imagens diretamente.");
        }
      } catch (err: any) {
        toast.error("Não foi possível copiar a imagem.");
      }
    }, "image/png");
  }

  return (
    <AppLayout title="Compartilhar" description="Gere uma imagem do resumo do mês">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={compartilhar}>
              <Share2 className="size-4" /> Compartilhar
            </Button>
            <Button variant="secondary" className="w-full" onClick={copiarParaClipboard}>
              <ImageIcon className="size-4" /> Copiar imagem
            </Button>
            <Button variant="outline" className="w-full" onClick={baixar}>
              <Download className="size-4" /> Baixar imagem
            </Button>
            <p className="text-xs text-muted-foreground">
              A imagem inclui receitas, despesas, saldo e as maiores categorias do mês selecionado.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ImageIcon className="size-4" /> Prévia do resumo — {monthLabel(mes)}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Preview label="Receitas" value={formatBRL(resumo.rec)} tone="text-success" />
              <Preview label="Despesas" value={formatBRL(resumo.desp)} tone="text-destructive" />
              <Preview
                label="Saldo"
                value={formatBRL(resumo.saldo)}
                tone={resumo.saldo >= 0 ? "text-primary" : "text-destructive"}
              />
            </div>
            <div className="space-y-1.5">
              {resumo.porCategoria.map(([cat, val]) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{cat}</span>
                  <span className="font-medium">{formatBRL(val)}</span>
                </div>
              ))}
              {resumo.porCategoria.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem lançamentos neste mês.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </AppLayout>
  );
}

function Preview({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}
