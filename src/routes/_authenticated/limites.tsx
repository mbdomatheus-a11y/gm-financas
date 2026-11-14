import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Gauge, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { LogoBanco } from "@/components/LogoBanco";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCartoes, useDespesas, useFaturasImportadas } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { pluggyListarContas } from "@/lib/pluggy.functions";
import { calcularLimitesCartoes } from "@/lib/limites-cartoes";
import { toBRL } from "@/lib/format";
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

function corUso(p: number): string {
  return p > 100 ? "bg-destructive" : p >= 80 ? "bg-warning" : "bg-success";
}

function textoUso(p: number): string {
  return p > 100 ? "text-destructive" : p >= 80 ? "text-warning-foreground dark:text-warning" : "text-success";
}

function BarraUso({ percentual }: { percentual: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percentual)}
      className="h-2 overflow-hidden rounded-full bg-muted"
    >
      <div className={cn("h-full rounded-full", corUso(percentual))} style={{ width: `${Math.max(0, Math.min(100, percentual))}%` }} />
    </div>
  );
}

function LimitesCartoes() {
  const { formatarResumo } = usePrivacidadeValores("limites");
  const { data: cartoes = [], isLoading: l1 } = useCartoes();
  const { data: faturas = [], isLoading: l2 } = useFaturasImportadas();
  const { data: despesas = [] } = useDespesas();
  const cotacao = useCotacao();
  const listarContas = useServerFn(pluggyListarContas);
  const { data: contasPluggy = [] } = useQuery({
    queryKey: ["pluggy-contas-limites"],
    retry: false,
    queryFn: async () => {
      try {
        const r: any = await listarContas();
        return (r?.contas ?? []) as any[];
      } catch {
        return [] as any[];
      }
    },
  });
  const { itens, consolidado } = useMemo(
    () =>
      calcularLimitesCartoes({
        cartoes: cartoes as any[],
        faturas: faturas as any[],
        contasPluggy,
        despesas: despesas as any[],
        conv: (v, m) => toBRL(v, m, cotacao),
      }),
    [cartoes, faturas, contasPluggy, despesas, cotacao],
  );

  if (l1 || l2) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (itens.length === 0)
    return (
      <Card className="rounded-3xl">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum limite de cartão ainda. Informe o limite no cadastro do cartão, importe uma fatura ou conecte o Open Finance.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-6">
          <p className="text-xs text-muted-foreground">Todos os cartões</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <Resumo rotulo="Limite total" valor={formatarResumo(consolidado.total)} />
            <Resumo rotulo="Consumido" valor={formatarResumo(consolidado.consumido)} classe={textoUso(consolidado.percentual)} />
            <Resumo rotulo="Disponível" valor={formatarResumo(consolidado.disponivel)} />
            <Resumo rotulo="Usado" valor={pct(consolidado.percentual)} classe={textoUso(consolidado.percentual)} />
          </div>
          <BarraUso percentual={consolidado.percentual} />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {itens.map((c) => {
          const perc = c.total > 0 ? (c.consumido / c.total) * 100 : 0;
          return (
            <Card key={c.key} className="rounded-3xl">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <LogoBanco nome={c.banco} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.origemRotulo}</p>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums", textoUso(perc))}>{pct(perc)}</span>
                </div>
                <BarraUso percentual={perc} />
                <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                  <Resumo pequeno rotulo="Total" valor={formatarResumo(c.total)} />
                  <Resumo pequeno rotulo="Consumido" valor={formatarResumo(c.consumido)} />
                  <Resumo pequeno rotulo="Disponível" valor={formatarResumo(c.disponivel)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Resumo({ rotulo, valor, classe, pequeno }: { rotulo: string; valor: string; classe?: string; pequeno?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={cn("font-semibold tabular-nums", pequeno ? "text-sm" : "text-xl", classe)}>{valor}</p>
    </div>
  );
}

function LimitesPage() {
  const { formatar } = usePrivacidadeValores("limites");
  const [aba, setAba] = useState("cartoes");
  const { usos, resumo, competencia, tabelaPendente, isLoading, excluir } = useUsoDosLimites();
  const [editando, setEditando] = useState<LimiteGasto | "novo" | null>(null);

  return (
    <AppLayout
      title="Limites"
      description="Limite dos cartões e quanto gastar por categoria"
      actions={
        aba !== "categorias" ? undefined : (
        <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setEditando("novo")} disabled={tabelaPendente}>
          <Plus className="size-4" /> Novo limite
        </Button>
        )
      }
    >
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-6 w-full sm:w-auto">
          <TabsTrigger value="cartoes" className="flex-1 sm:flex-none">Cartões</TabsTrigger>
          <TabsTrigger value="categorias" className="flex-1 sm:flex-none">Limites por categoria</TabsTrigger>
        </TabsList>
        <TabsContent value="cartoes">
          <LimitesCartoes />
        </TabsContent>
        <TabsContent value="categorias">
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

        </TabsContent>
      </Tabs>

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
