import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Gauge, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { BarraLimite } from "@/components/LimitesResumoCard";
import { SelectBusca } from "@/components/SelectBusca";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEstruturaCategorias } from "@/hooks/useEstruturaCategorias";
import { type LimiteGasto, useUsoDosLimites } from "@/hooks/useLimites";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { monthLabelLong } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/limites")({
  head: () => ({ meta: [{ title: "Limites de gastos | Control ALL" }] }),
  component: LimitesPage,
});

function pct(v: number): string {
  return `${Math.round(v)}%`;
}

function LimitesPage() {
  const { formatar } = usePrivacidadeValores("limites");
  const { usos, resumo, competencia, tabelaPendente, isLoading, excluir } = useUsoDosLimites();
  const [editando, setEditando] = useState<LimiteGasto | "novo" | null>(null);

  return (
    <AppLayout
      title="Limites de gastos"
      description="Defina quanto gastar por categoria e acompanhe o ciclo"
      actions={
        <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setEditando("novo")} disabled={tabelaPendente}>
          <Plus className="size-4" /> Novo limite
        </Button>
      }
    >
      {tabelaPendente && (
        <Card className="mb-6 rounded-3xl border-warning/40 bg-warning/10">
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground dark:text-warning" aria-hidden="true" />
            <p>
              Os limites ainda não foram ativados no banco de dados. Assim que a atualização for aplicada, esta tela passa a
              funcionar sem nenhuma ação sua.
            </p>
          </CardContent>
        </Card>
      )}

      {usos.length > 0 && (
        <Card className="mb-6 rounded-3xl">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <p className="text-xs text-muted-foreground">Ciclo de {monthLabelLong(competencia)}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatar(resumo.gastoTotal)}{" "}
                <span className="text-base font-normal text-muted-foreground">de {formatar(resumo.limiteTotal)}</span>
              </p>
            </div>
            <Contador icone={CheckCircle2} rotulo="Dentro do limite" valor={resumo.dentro} classe="text-success" />
            <Contador icone={TrendingUp} rotulo="Em alerta" valor={resumo.alerta} classe="text-warning-foreground dark:text-warning" />
            <Contador icone={AlertTriangle} rotulo="Estourados" valor={resumo.estourados} classe="text-destructive" />
            <Contador icone={Gauge} rotulo="Limites ativos" valor={resumo.total} classe="text-primary" />
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && !tabelaPendente && usos.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Gauge className="size-7" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Coloque um teto nos seus gastos</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Escolha uma categoria, defina quanto pode gastar por mês e receba o aviso antes de passar do ponto.
              </p>
            </div>
            <Button className="rounded-full" onClick={() => setEditando("novo")}>
              <Plus className="size-4" /> Criar primeiro limite
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {usos.map((uso) => (
          <Card key={uso.limite.id} className="rounded-3xl">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{uso.limite.categoria}</p>
                  <p className="text-xs text-muted-foreground">
                    Alerta em {uso.limite.alerta_percentual}% · {pct(uso.percentual)} usado
                  </p>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Editar limite" onClick={() => setEditando(uso.limite)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir limite"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (!window.confirm(`Excluir o limite de "${uso.limite.categoria}"?`)) return;
                      excluir.mutate(uso.limite.id, {
                        onSuccess: () => toast.success("Limite excluído."),
                        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <BarraLimite uso={uso} />
              <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                <span>
                  <b>{formatar(uso.gasto)}</b> <span className="text-muted-foreground">de {formatar(uso.limite.valor_mensal)}</span>
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    uso.status === "ok" && "text-success",
                    uso.status === "alerta" && "text-warning-foreground dark:text-warning",
                    uso.status === "estourado" && "text-destructive",
                  )}
                >
                  {uso.restante >= 0 ? `Restam ${formatar(uso.restante)}` : `Passou ${formatar(-uso.restante)}`}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editando && (
        <FormLimite
          limite={editando === "novo" ? null : editando}
          usadas={usos.map((u) => u.limite.categoria)}
          onFechar={() => setEditando(null)}
        />
      )}
    </AppLayout>
  );
}

function Contador({
  icone: Icone,
  rotulo,
  valor,
  classe,
}: {
  icone: typeof Gauge;
  rotulo: string;
  valor: number;
  classe: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
      <Icone className={cn("size-5 shrink-0", classe)} aria-hidden="true" />
      <div>
        <p className="text-xl font-semibold tabular-nums leading-none">{valor}</p>
        <p className="mt-1 text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function FormLimite({
  limite,
  usadas,
  onFechar,
}: {
  limite: LimiteGasto | null;
  usadas: string[];
  onFechar: () => void;
}) {
  const { salvar } = useUsoDosLimites();
  const { estrutura } = useEstruturaCategorias("despesa");
  const [categoria, setCategoria] = useState<string | null>(limite?.categoria ?? null);
  const [valor, setValor] = useState(limite ? String(limite.valor_mensal.toFixed(2)).replace(".", ",") : "");
  const [alerta, setAlerta] = useState<number>(limite?.alerta_percentual ?? 80);

  const opcoes = useMemo(() => {
    const ja = new Set(usadas.map((u) => u.toLowerCase()));
    return estrutura
      .filter((e) => e.macro === limite?.categoria || !ja.has(e.macro.toLowerCase()))
      .map((e) => ({ valor: e.macro, rotulo: e.macro }));
  }, [estrutura, usadas, limite]);

  function enviar() {
    const numero = Number(valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
    salvar.mutate(
      { id: limite?.id, categoria: categoria ?? "", valor_mensal: numero, alerta_percentual: alerta },
      {
        onSuccess: () => {
          toast.success("Limite salvo.");
          onFechar();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{limite ? "Editar limite" : "Novo limite"}</DialogTitle>
          <DialogDescription>O gasto é somado no ciclo vigente, com as parcelas que vencem nele.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <SelectBusca
              valor={categoria}
              opcoes={opcoes}
              onEscolher={setCategoria}
              placeholder="Escolha a categoria"
              ariaLabel="Categoria do limite"
              disabled={!!limite}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="limite-valor">Valor por mês (R$)</Label>
            <Input
              id="limite-valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="800,00"
              className="tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Avisar ao atingir</Label>
              <span className="text-sm font-semibold tabular-nums">{alerta}%</span>
            </div>
            <Slider min={50} max={100} step={5} value={[alerta]} onValueChange={(v) => setAlerta(v[0] ?? 80)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-full" onClick={onFechar}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={enviar} disabled={salvar.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
