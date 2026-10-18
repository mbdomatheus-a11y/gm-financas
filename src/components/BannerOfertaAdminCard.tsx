import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Timer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminObterBannerOferta, adminSalvarBannerOferta } from "@/lib/banner-oferta.functions";

/** Converte ISO para o valor de <input type="datetime-local"> no fuso local. */
function paraCampoLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatarData(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Admin grava início, duração total e liga/desliga. O fim é calculado e fica fixo. */
export function BannerOfertaAdminCard() {
  const qc = useQueryClient();
  const obter = useServerFn(adminObterBannerOferta);
  const salvar = useServerFn(adminSalvarBannerOferta);
  const { data } = useQuery({ queryKey: ["banner-oferta-admin"], queryFn: () => obter() });

  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [duracao, setDuracao] = useState<string | null>(null);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [botao, setBotao] = useState<string | null>(null);

  const ativoAtual = ativo ?? data?.ativo ?? false;
  const inicioAtual = inicio ?? paraCampoLocal(data?.inicio ?? null);
  const duracaoAtual =
    duracao ??
    (data?.inicio && data?.fim
      ? String(Math.round((Date.parse(data.fim) - Date.parse(data.inicio)) / 3_600_000))
      : "");

  const tituloAtual = titulo ?? data?.titulo ?? "";
  const textoAtual = texto ?? data?.texto ?? "";
  const botaoAtual = botao ?? data?.botao ?? "";
  const duracaoNum = Number(duracaoAtual);
  const fimPrevisto =
    inicioAtual && duracaoNum > 0
      ? new Date(new Date(inicioAtual).getTime() + duracaoNum * 3_600_000).toISOString()
      : null;

  const mutacao = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          ativo: ativoAtual,
          inicio: inicioAtual ? new Date(inicioAtual).toISOString() : null,
          duracaoHoras: duracaoNum > 0 ? duracaoNum : null,
          titulo: tituloAtual,
          texto: textoAtual,
          botao: botaoAtual,
        },
      }),
    onSuccess: () => {
      toast.success("Banner de oferta atualizado.");
      setAtivo(null);
      setInicio(null);
      setDuracao(null);
      setTitulo(null);
      setTexto(null);
      setBotao(null);
      qc.invalidateQueries({ queryKey: ["banner-oferta-admin"] });
      qc.invalidateQueries({ queryKey: ["banner-oferta-home"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Timer className="size-4" /> Banner de oferta com contador (home)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          O contador conta até o fim fixo da janela. Desligar no meio não zera o tempo; ligar de novo
          mostra o que falta. Para uma nova campanha, grave novo início e duração.
        </p>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="banner-oferta-titulo" className="text-xs">Título (acima do contador)</Label>
            <Input id="banner-oferta-titulo" maxLength={80} value={tituloAtual} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-oferta-texto" className="text-xs">Texto (abaixo do contador)</Label>
            <Input id="banner-oferta-texto" maxLength={160} value={textoAtual} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-oferta-botao" className="text-xs">Texto do botão</Label>
            <Input id="banner-oferta-botao" maxLength={32} value={botaoAtual} onChange={(e) => setBotao(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="banner-oferta-ativo" className="text-sm">Exibir banner na home</Label>
          <Switch
            id="banner-oferta-ativo"
            checked={ativoAtual}
            disabled={!data || mutacao.isPending}
            onCheckedChange={(v) => setAtivo(v)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="banner-oferta-inicio" className="text-xs">Início</Label>
            <Input
              id="banner-oferta-inicio"
              type="datetime-local"
              value={inicioAtual}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-oferta-duracao" className="text-xs">Duração total (horas)</Label>
            <Input
              id="banner-oferta-duracao"
              type="number"
              min={1}
              max={2160}
              value={duracaoAtual}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Fim previsto: <span className="font-medium text-foreground">{formatarData(fimPrevisto)}</span>
            {data?.fim && (
              <> · Fim gravado: <span className="font-medium text-foreground">{formatarData(data.fim)}</span></>
            )}
          </p>
          <Button size="sm" onClick={() => mutacao.mutate()} disabled={mutacao.isPending || !data}>
            Salvar banner
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
