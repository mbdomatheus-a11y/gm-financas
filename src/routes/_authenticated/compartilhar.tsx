import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Car,
  Download,
  Image as ImageIcon,
  Receipt,
  Share2,
  ShoppingCart,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDespesas, useReceitas, useVeiculos } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { useModulosGlobais, useProfile } from "@/hooks/useAuthData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { currentMonthKey, formatBRL, formatDate, monthKey, monthLabel, toBRL } from "@/lib/format";
import { alertasDosVeiculos } from "@/lib/veiculo-alertas";

export const Route = createFileRoute("/_authenticated/compartilhar")({
  head: () => ({
    meta: [
      { title: "Compartilhar — Control ALL" },
      {
        name: "description",
        content:
          "Gere um resumo ou imagem de finanças, lista de compras, notas fiscais ou veículos para compartilhar no WhatsApp ou salvar.",
      },
      { property: "og:title", content: "Compartilhar — Control ALL" },
      {
        property: "og:description",
        content: "Resumos prontos para compartilhar no WhatsApp ou salvar.",
      },
    ],
  }),
  component: CompartilharPage,
});

/** Abre o WhatsApp com o texto pronto, ou tenta o compartilhamento nativo do
 * aparelho quando disponível (mobile). Mesmo padrão já usado pra finanças. */
async function compartilharTexto(texto: string, titulo: string) {
  const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
  if (nav.canShare?.({ text: texto })) {
    try {
      await navigator.share({ text: texto, title: titulo });
      return;
    } catch {
      /* cancelado pelo usuário — cai no fallback do WhatsApp Web */
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
}

async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Texto copiado");
  } catch {
    toast.error("Não foi possível copiar — tente novamente.");
  }
}

function CompartilharPage() {
  const { habilitado } = useModulosGlobais();

  return (
    <AppLayout title="Compartilhar" description="Gere um resumo pronto para compartilhar">
      <Tabs defaultValue="financas" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="financas" className="gap-1.5 text-xs">
            <Wallet className="size-3.5" /> Finanças
          </TabsTrigger>
          {habilitado("lista") && (
            <TabsTrigger value="lista" className="gap-1.5 text-xs">
              <ShoppingCart className="size-3.5" /> Lista de compras
            </TabsTrigger>
          )}
          {habilitado("notas") && (
            <TabsTrigger value="notas" className="gap-1.5 text-xs">
              <Receipt className="size-3.5" /> Notas fiscais
            </TabsTrigger>
          )}
          {habilitado("veiculo") && (
            <TabsTrigger value="veiculos" className="gap-1.5 text-xs">
              <Car className="size-3.5" /> Veículos
            </TabsTrigger>
          )}
          <TabsTrigger value="inteligente" className="gap-1.5 text-xs">
            <Sparkles className="size-3.5" /> Resumo inteligente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financas">
          <FinancasShareCard />
        </TabsContent>
        {habilitado("lista") && (
          <TabsContent value="lista">
            <ListaComprasShareCard />
          </TabsContent>
        )}
        {habilitado("notas") && (
          <TabsContent value="notas">
            <NotasFiscaisShareCard />
          </TabsContent>
        )}
        {habilitado("veiculo") && (
          <TabsContent value="veiculos">
            <VeiculosShareCard />
          </TabsContent>
        )}
        <TabsContent value="inteligente">
          <ResumoInteligenteShareCard />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

/** ─── Finanças: gera uma imagem (canvas) do resumo do mês, como já era antes. ─── */
function FinancasShareCard() {
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
      } catch {
        toast.error("Não foi possível copiar a imagem.");
      }
    }, "image/png");
  }

  return (
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

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}

/** ─── Lista de compras: resumo em texto dos itens pendentes, pronto pra WhatsApp. ─── */
function ListaComprasShareCard() {
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["lista-compras-compartilhar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("nome,quantidade,comprado")
        .order("comprado")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendentes = useMemo(() => (itens as any[]).filter((i) => !i.comprado), [itens]);

  const texto = useMemo(() => {
    if (pendentes.length === 0) return "Lista de compras\n\nNenhum item pendente. 🎉";
    const linhas = pendentes.map(
      (i: any) => `• ${i.nome}${i.quantidade > 1 ? ` (${i.quantidade}x)` : ""}`,
    );
    return `Lista de compras (${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""})\n\n${linhas.join("\n")}`;
  }, [pendentes]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardContent className="space-y-4 p-4">
          <Button
            className="w-full"
            disabled={isLoading}
            onClick={() => compartilharTexto(texto, "Lista de compras")}
          >
            <Share2 className="size-4" /> Compartilhar
          </Button>
          <Button variant="outline" className="w-full" onClick={() => copiarTexto(texto)}>
            <ImageIcon className="size-4" /> Copiar texto
          </Button>
          <p className="text-xs text-muted-foreground">
            Envia os itens ainda pendentes de compra, com quantidade.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="size-4" /> Prévia
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{texto}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

/** ─── Notas fiscais: resumo em texto de quantidade e total gasto no mês. ─── */
function NotasFiscaisShareCard() {
  const [mes, setMes] = useState(currentMonthKey());
  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas-fiscais-compartilhar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("estabelecimento,data_compra,valor_total")
        .order("data_compra", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const meses = useMemo(() => {
    const set = new Set<string>([currentMonthKey()]);
    (notas as any[]).forEach((n) => set.add(monthKey(n.data_compra)));
    return [...set].sort().reverse();
  }, [notas]);

  const doMes = useMemo(
    () => (notas as any[]).filter((n) => monthKey(n.data_compra) === mes),
    [notas, mes],
  );
  const total = useMemo(
    () => doMes.reduce((s, n: any) => s + Number(n.valor_total ?? 0), 0),
    [doMes],
  );

  const texto = useMemo(() => {
    if (doMes.length === 0) return `Notas fiscais — ${monthLabel(mes)}\n\nNenhuma nota registrada.`;
    const top = [...doMes]
      .sort((a: any, b: any) => Number(b.valor_total ?? 0) - Number(a.valor_total ?? 0))
      .slice(0, 5)
      .map((n: any) => `• ${n.estabelecimento || "Sem nome"}: ${formatBRL(Number(n.valor_total ?? 0))}`);
    return `Notas fiscais — ${monthLabel(mes)}\n\n${doMes.length} nota${doMes.length > 1 ? "s" : ""} · Total: ${formatBRL(total)}\n\nMaiores compras:\n${top.join("\n")}`;
  }, [doMes, mes, total]);

  return (
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
          <Button
            className="w-full"
            disabled={isLoading}
            onClick={() => compartilharTexto(texto, "Notas fiscais")}
          >
            <Share2 className="size-4" /> Compartilhar
          </Button>
          <Button variant="outline" className="w-full" onClick={() => copiarTexto(texto)}>
            <ImageIcon className="size-4" /> Copiar texto
          </Button>
          <p className="text-xs text-muted-foreground">
            Não inclui as fotos das notas — só o resumo em texto (quantidade, total e maiores
            compras do mês).
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="size-4" /> Prévia
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{texto}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

/** ─── Veículos: resumo em texto com alertas ativos (óleo, IPVA, seguro). ─── */
function VeiculosShareCard() {
  const { data: veiculos = [], isLoading } = useVeiculos();

  const alertas = useMemo(() => alertasDosVeiculos(veiculos as any[]), [veiculos]);

  const texto = useMemo(() => {
    if ((veiculos as any[]).length === 0) return "Veículos\n\nNenhum veículo cadastrado.";
    const linhasVeiculos = (veiculos as any[]).map((v: any) => {
      const km = v.km_atual != null ? ` · ${Number(v.km_atual).toLocaleString("pt-BR")} km` : "";
      return `• ${v.nome}${km}`;
    });
    const linhasAlertas = alertas.map((a) => `⚠️ ${a.veiculoNome}: ${a.mensagem}`);
    return [
      `Veículos (${(veiculos as any[]).length})`,
      "",
      linhasVeiculos.join("\n"),
      ...(linhasAlertas.length ? ["", "Alertas:", linhasAlertas.join("\n")] : []),
    ].join("\n");
  }, [veiculos, alertas]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardContent className="space-y-4 p-4">
          <Button
            className="w-full"
            disabled={isLoading}
            onClick={() => compartilharTexto(texto, "Veículos")}
          >
            <Share2 className="size-4" /> Compartilhar
          </Button>
          <Button variant="outline" className="w-full" onClick={() => copiarTexto(texto)}>
            <ImageIcon className="size-4" /> Copiar texto
          </Button>
          <p className="text-xs text-muted-foreground">
            Inclui os veículos cadastrados e os alertas ativos (troca de óleo, IPVA, seguro).
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Car className="size-4" /> Prévia
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{texto}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

/** ─── Resumo inteligente: um texto único juntando os pontos mais relevantes
 * de finanças, lista de compras e veículos — pensado pra mandar de uma vez
 * só pra alguém que quer só o essencial, sem abrir o site. ─── */
function ResumoInteligenteShareCard() {
  const cotacao = useCotacao();
  const { habilitado } = useModulosGlobais();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const { data: veiculos = [] } = useVeiculos();
  const { data: itensLista = [] } = useQuery({
    queryKey: ["lista-compras-compartilhar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("nome,quantidade,comprado")
        .order("comprado")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: habilitado("lista"),
  });

  const mes = currentMonthKey();
  const alertasVeiculos = useMemo(
    () => (habilitado("veiculo") ? alertasDosVeiculos(veiculos as any[]) : []),
    [veiculos, habilitado],
  );

  const resumo = useMemo(() => {
    const rec = (receitas as any[])
      .filter((r) => monthKey(r.data_recebimento) === mes)
      .reduce((s, r) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
    const parcelasMes = (despesas as any[]).flatMap((d) =>
      (d.parcelas ?? [])
        .filter((p: any) => monthKey(p.vencimento) === mes)
        .map((p: any) => ({ ...p, moeda: d.moeda })),
    );
    const desp = parcelasMes.reduce((s, p: any) => s + toBRL(Number(p.valor), p.moeda, cotacao), 0);
    const pendentesLista = (itensLista as any[]).filter((i) => !i.comprado).length;
    return { rec, desp, saldo: rec - desp, pendentesLista };
  }, [receitas, despesas, itensLista, mes, cotacao]);

  const texto = useMemo(() => {
    const linhas = [
      `Resumo — ${monthLabel(mes)}`,
      "",
      `💰 Receitas: ${formatBRL(resumo.rec)}`,
      `💸 Despesas: ${formatBRL(resumo.desp)}`,
      `${resumo.saldo >= 0 ? "✅" : "🔴"} Saldo: ${formatBRL(resumo.saldo)}`,
    ];
    if (habilitado("lista")) {
      linhas.push(
        resumo.pendentesLista > 0
          ? `🛒 ${resumo.pendentesLista} item(ns) pendente(s) na lista de compras`
          : "🛒 Lista de compras sem pendências",
      );
    }
    if (habilitado("veiculo") && alertasVeiculos.length > 0) {
      linhas.push(`🚗 ${alertasVeiculos.length} alerta(s) de veículo em aberto`);
    }
    linhas.push("", `Gerado em ${formatDate(new Date().toISOString())}`);
    return linhas.join("\n");
  }, [resumo, alertasVeiculos, habilitado, mes]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardContent className="space-y-4 p-4">
          <Button className="w-full" onClick={() => compartilharTexto(texto, "Resumo inteligente")}>
            <Share2 className="size-4" /> Compartilhar
          </Button>
          <Button variant="outline" className="w-full" onClick={() => copiarTexto(texto)}>
            <ImageIcon className="size-4" /> Copiar texto
          </Button>
          <p className="text-xs text-muted-foreground">
            Junta o essencial de finanças, lista de compras e veículos num único resumo — bom pra
            mandar rapidinho sem abrir o site.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4" /> Prévia
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{texto}</pre>
        </CardContent>
      </Card>
    </div>
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
