import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Info, Timer } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, toISODate } from "@/lib/format";
import {
  diferencaEntreDatas,
  somarHorarios,
  somarIntervaloData,
  type TermoHorario,
  type UnidadeIntervalo,
  type UnidadeTempo,
} from "@/lib/calculadora-datas";

export const Route = createFileRoute("/_authenticated/ferramentas")({
  head: () => ({
    meta: [
      { title: "Control ALL — Ferramentas" },
      {
        name: "description",
        content:
          "Calculadora de datas e de horários, ferramentas de uso geral do módulo Control ALL.",
      },
      { property: "og:title", content: "Control ALL — Ferramentas" },
      {
        property: "og:description",
        content: "Calculadora de datas e de horários, sem relação com seus dados financeiros.",
      },
    ],
  }),
  component: FerramentasPage,
});

const UNIDADES_TEMPO: { id: UnidadeTempo; label: string }[] = [
  { id: "dias", label: "dias" },
  { id: "horas", label: "horas" },
  { id: "minutos", label: "minutos" },
];

const UNIDADES_INTERVALO: { id: UnidadeIntervalo; label: string }[] = [
  { id: "dias", label: "dias" },
  { id: "meses", label: "meses" },
  { id: "anos", label: "anos" },
];

function DiferencaEntreDatas() {
  const hoje = toISODate(new Date());
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(hoje);
  const [unidade, setUnidade] = useState<UnidadeTempo>("dias");

  const resultado = useMemo(
    () => (inicio && fim ? diferencaEntreDatas(inicio, fim, unidade) : null),
    [inicio, fim, unidade],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="data-inicio">Data inicial</Label>
          <Input
            id="data-inicio"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data-fim">Data final</Label>
          <Input id="data-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Mostrar diferença em</Label>
        <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeTempo)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIDADES_TEMPO.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {resultado != null && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">
            {resultado}{" "}
            <span className="text-base font-medium text-muted-foreground">{unidade}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            entre {formatDate(inicio)} e {formatDate(fim)}
          </p>
        </div>
      )}
    </div>
  );
}

function DataMaisIntervalo() {
  const hoje = toISODate(new Date());
  const [base, setBase] = useState(hoje);
  const [quantidade, setQuantidade] = useState("30");
  const [unidade, setUnidade] = useState<UnidadeIntervalo>("dias");
  const [operacao, setOperacao] = useState<"soma" | "subtrai">("soma");

  const resultado = useMemo(() => {
    const n = Number(quantidade);
    if (!base || !Number.isFinite(n)) return null;
    return somarIntervaloData(base, operacao === "soma" ? n : -n, unidade);
  }, [base, quantidade, unidade, operacao]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="data-base">Data de partida</Label>
        <Input id="data-base" type="date" value={base} onChange={(e) => setBase(e.target.value)} />
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-2 sm:grid-cols-[auto_auto_1fr]">
        <div className="space-y-1.5">
          <Label>Operação</Label>
          <Select value={operacao} onValueChange={(v) => setOperacao(v as "soma" | "subtrai")}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soma">+</SelectItem>
              <SelectItem value="subtrai">−</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantidade-intervalo">Quantidade</Label>
          <Input
            id="quantidade-intervalo"
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Unidade</Label>
          <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeIntervalo)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES_INTERVALO.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {resultado && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{formatDate(resultado)}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(base)} {operacao === "soma" ? "+" : "−"} {quantidade} {unidade}
          </p>
        </div>
      )}
    </div>
  );
}

type LinhaHorario = { id: string; sinal: "1" | "-1"; horas: string; minutos: string };

function novaLinhaHorario(sinal: "1" | "-1" = "1"): LinhaHorario {
  return { id: crypto.randomUUID(), sinal, horas: "0", minutos: "0" };
}

function CalculadoraHorarios() {
  const [linhas, setLinhas] = useState<LinhaHorario[]>([
    { ...novaLinhaHorario("1"), horas: "8", minutos: "0" },
  ]);

  const resultado = useMemo(() => {
    const termos: TermoHorario[] = linhas.map((l) => ({
      sinal: l.sinal === "1" ? 1 : -1,
      horas: Math.max(0, Number(l.horas) || 0),
      minutos: Math.max(0, Number(l.minutos) || 0),
    }));
    return somarHorarios(termos);
  }, [linhas]);

  function atualizar(id: string, patch: Partial<LinhaHorario>) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={l.id} className="flex items-center gap-2">
            {i === 0 ? (
              <span className="w-8 text-center text-sm text-muted-foreground">&nbsp;</span>
            ) : (
              <Select
                value={l.sinal}
                onValueChange={(v) => atualizar(l.id, { sinal: v as "1" | "-1" })}
              >
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">+</SelectItem>
                  <SelectItem value="-1">−</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              type="number"
              min={0}
              value={l.horas}
              onChange={(e) => atualizar(l.id, { horas: e.target.value })}
              className="w-20"
              aria-label="Horas"
            />
            <span className="text-muted-foreground">h</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={l.minutos}
              onChange={(e) => atualizar(l.id, { minutos: e.target.value })}
              className="w-20"
              aria-label="Minutos"
            />
            <span className="text-muted-foreground">min</span>
            {linhas.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 px-2 text-xs text-muted-foreground"
                onClick={() => setLinhas((prev) => prev.filter((x) => x.id !== l.id))}
              >
                Remover
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLinhas((prev) => [...prev, novaLinhaHorario("1")])}
      >
        + Adicionar horário
      </Button>
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-2xl font-bold tabular-nums">
          {resultado.negativo ? "−" : ""}
          {String(resultado.horas).padStart(2, "0")}:{String(resultado.minutos).padStart(2, "0")}
        </p>
        <p className="text-xs text-muted-foreground">Total (horas:minutos)</p>
      </div>
    </div>
  );
}

function FerramentasPage() {
  return (
    <AppLayout
      title="Control ALL"
      description="Ferramentas de uso geral — sem relação com seus dados financeiros."
    >
      <div className="space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 size-4.5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Sobre o módulo Control ALL</p>
              <p className="mt-1 text-muted-foreground">
                Este é um conjunto de calculadoras e ferramentas de uso geral (datas, horários e as
                que forem adicionadas depois) que não dependem de nenhum dado financeiro do casal —
                funcionam do mesmo jeito pra qualquer pessoa. A ideia é evoluir esse módulo aos
                poucos até virar um produto independente, que poderá futuramente ser oferecido
                separadamente deste app. Por enquanto ele mora aqui dentro, mas o que você digita
                aqui não é salvo em lugar nenhum — cada cálculo é só local, na sua tela.
              </p>
              <Badge variant="outline" className="mt-2 border-primary/40 text-primary">
                Em construção
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4.5" /> Diferença entre datas
            </CardTitle>
            <CardDescription>Quantos dias, horas ou minutos há entre duas datas.</CardDescription>
          </CardHeader>
          <CardContent>
            <DiferencaEntreDatas />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="size-4.5" /> Data mais (ou menos) um intervalo
            </CardTitle>
            <CardDescription>
              Ex.: que dia é 01/01/2028 mais 90 dias, ou 6 meses antes de uma data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataMaisIntervalo />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="size-4.5" /> Soma e subtração de horários
            </CardTitle>
            <CardDescription>Ex.: 08:00 + 7:20 − 1:15.</CardDescription>
          </CardHeader>
          <CardContent>
            <CalculadoraHorarios />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
