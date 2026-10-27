import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { monthKey, monthLabelLong } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import {
  type Caixinha,
  aportadoNoMes,
  excluirCaixinha,
  linhaDoTempo,
  listarCaixinhas,
  metaDoMes,
  registrarAporte,
  salvarCaixinha,
  totalGuardado,
} from "@/lib/poupar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/caixinhas")({
  head: () => ({ meta: [{ title: "Caixinhas | Control ALL" }] }),
  component: CaixinhasPage,
});

/**
 * Caixinhas no site (27/10/2026), iguais às do app: objetivo com valor por mês, aporte marcado mês a
 * mês. O valor a guardar no mês entra na Previsão do mês (Início) do site e do app.
 */
function CaixinhasPage() {
  const qc = useQueryClient();
  const mes = useCompetenciaVigente();
  const { formatar } = usePrivacidadeValores("caixinhas");
  const { data: caixinhas = [], isLoading } = useQuery({ queryKey: ["caixinhas"], queryFn: listarCaixinhas });
  const [editando, setEditando] = useState<Caixinha | "nova" | null>(null);

  const aporte = useMutation({
    mutationFn: ({ c, m, valor }: { c: Caixinha; m: string; valor: number | null }) => registrarAporte(c.id, m, valor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caixinhas"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar."),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirCaixinha(id),
    onSuccess: () => {
      toast.success("Caixinha excluída.");
      qc.invalidateQueries({ queryKey: ["caixinhas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });

  const meta = metaDoMes(caixinhas, mes);
  const aportado = aportadoNoMes(caixinhas, mes);

  return (
    <AppLayout
      title="Caixinhas"
      description="Objetivos para guardar dinheiro todo mês"
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setEditando("nova")}>
          <Plus className="size-4" /> Nova caixinha
        </Button>
      }
    >
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">A guardar em {monthLabelLong(mes)}</p>
            <p className="text-xl font-bold">{formatar(meta)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Já guardado neste mês</p>
            <p className="text-xl font-bold text-emerald-600">{formatar(aportado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total guardado em todas</p>
            <p className="text-xl font-bold">{formatar(caixinhas.reduce((s, c) => s + totalGuardado(c), 0))}</p>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            O valor a guardar no mês entra na Previsão do mês, no site e no app.
          </p>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && caixinhas.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <PiggyBank className="size-10 text-primary" />
            <p className="text-sm text-muted-foreground">Crie um objetivo (viagem, reserva, carro) e quanto quer guardar por mês.</p>
            <Button onClick={() => setEditando("nova")}>
              <Plus className="size-4" /> Criar caixinha
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {caixinhas.map((c) => {
          const meses = linhaDoTempo(c, monthKey(new Date()));
          const total = totalGuardado(c);
          const objetivo = c.fim ? meses.length * c.valorMensal : null;
          const doMes = c.aportes[mes] ?? 0;
          return (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatar(c.valorMensal)} por mês · {monthLabelLong(c.inicio)}
                      {c.fim ? ` a ${monthLabelLong(c.fim)}` : " · sem prazo"}
                    </p>
                  </div>
                  <div className="flex">
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditando(c)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(`Excluir a caixinha "${c.nome}" e os aportes marcados?`)) excluir.mutate(c.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>Guardado: <b>{formatar(total)}</b></span>
                    {objetivo != null && <span className="text-muted-foreground">Objetivo {formatar(objetivo)}</span>}
                  </div>
                  {objetivo != null && <Progress value={objetivo > 0 ? Math.min(100, (total / objetivo) * 100) : 0} />}
                </div>
                <Button
                  size="sm"
                  variant={doMes >= c.valorMensal - 0.005 ? "secondary" : "default"}
                  className="w-full gap-1.5"
                  disabled={aporte.isPending || mes < c.inicio || (!!c.fim && mes > c.fim)}
                  onClick={() => aporte.mutate({ c, m: mes, valor: doMes > 0 ? null : c.valorMensal })}
                >
                  <Check className="size-4" />
                  {doMes > 0 ? `Guardado em ${monthLabelLong(mes)} (desmarcar)` : `Marcar ${formatar(c.valorMensal)} guardado em ${monthLabelLong(mes)}`}
                </Button>
                <div className="flex flex-wrap gap-1">
                  {meses.slice(-12).map((m) => (
                    <button
                      key={m.mes}
                      type="button"
                      title={`${monthLabelLong(m.mes)}: ${formatar(m.aportado)} de ${formatar(m.meta)}`}
                      disabled={m.situacao === "futuro" || aporte.isPending}
                      onClick={() => aporte.mutate({ c, m: m.mes, valor: m.aportado > 0 ? null : c.valorMensal })}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-medium capitalize",
                        m.situacao === "atingiu" && "bg-emerald-500/15 text-emerald-700",
                        m.situacao === "faltou" && "bg-rose-500/15 text-rose-700",
                        m.situacao === "aberto" && "bg-amber-500/15 text-amber-700",
                        m.situacao === "futuro" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {monthLabelLong(m.mes).slice(0, 3)}/{m.mes.slice(2, 4)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editando && <FormCaixinha caixinha={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} />}
    </AppLayout>
  );
}

function FormCaixinha({ caixinha, onFechar }: { caixinha: Caixinha | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(caixinha?.nome ?? "");
  const [valor, setValor] = useState(caixinha ? String(caixinha.valorMensal).replace(".", ",") : "");
  const [inicio, setInicio] = useState(caixinha?.inicio ?? monthKey(new Date()));
  const [fim, setFim] = useState(caixinha?.fim ?? "");
  const salvar = useMutation({
    mutationFn: () =>
      salvarCaixinha({ nome, valorMensal: Number(valor.replace(/\./g, "").replace(",", ".")) || 0, inicio, fim: fim || null }, caixinha?.id),
    onSuccess: () => {
      toast.success("Caixinha salva.");
      qc.invalidateQueries({ queryKey: ["caixinhas"] });
      onFechar();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{caixinha ? "Editar caixinha" : "Nova caixinha"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Objetivo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Viagem, reserva de emergência" />
          </div>
          <div className="space-y-1">
            <Label>Valor por mês (R$)</Label>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="500,00" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Começa em</Label>
              <Input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Termina em (opcional)</Label>
              <Input type="month" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
