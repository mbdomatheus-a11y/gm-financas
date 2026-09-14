import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { ProjecaoRendimento } from "@/components/ProjecaoRendimento";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { RESPONSAVEIS_EXTRA, useInvestimentos, useProfilesList } from "@/hooks/useFinance";
import { usePermissoes } from "@/hooks/useAuthData";
import { formatBRL, formatDate, toISODate } from "@/lib/format";
import { TIPOS_RENDIMENTO, type TipoRendimento } from "@/lib/rendimento";

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — Control ALL" },
      {
        name: "description",
        content: "Acompanhe aportes, resgates, rentabilidade e patrimônio investido do casal.",
      },
      { property: "og:title", content: "Investimentos — Control ALL" },
      {
        property: "og:description",
        content: "Carteira de investimentos do casal com aportes, resgates e rendimento.",
      },
    ],
  }),
  component: InvestimentosPage,
});

const TIPOS = ["Renda fixa", "Tesouro Direto", "Ações", "FIIs", "Cripto", "Poupança", "Outro"];
const CORES = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#db2777", "#0891b2", "#64748b"];

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  tipo: z.string().min(1, "Selecione o tipo"),
  instituicao: z.string().max(80).nullable(),
  valor_investido: z.number().positive("Informe o valor aplicado"),
  valor_atual: z.number().nonnegative(),
  data_investimento: z.string().min(10),
  rentabilidade: z.string().max(60).nullable(),
  responsavel: z.string().min(1, "Informe o responsável"),
  observacoes: z.string().max(500).nullable(),
  tipo_rendimento: z.enum(["cdi", "selic", "ipca_mais", "fixo"]).nullable(),
  percentual_rendimento: z.number().nullable(),
});

function InvestimentosPage() {
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const { data: investimentos = [] } = useInvestimentos();
  const { data: perfis = [] } = useProfilesList();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mov, setMov] = useState<{ id: string; tipo: "aporte" | "resgate" } | null>(null);
  const [valorMov, setValorMov] = useState("");
  const emptyForm = {
    nome: "",
    tipo: "",
    instituicao: "",
    valor_investido: "",
    valor_atual: "",
    data_investimento: toISODate(new Date()),
    rentabilidade: "",
    responsavel: "",
    observacoes: "",
    tipo_rendimento: "",
    percentual_rendimento: "",
  };
  const [form, setForm] = useState<any>(emptyForm);

  function abrirNovo() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function abrirEdicao(i: any) {
    if (!can("investimentos", "editar")) return;
    setEditId(i.id);
    setForm({
      nome: i.nome ?? "",
      tipo: i.tipo ?? "",
      instituicao: i.instituicao ?? "",
      valor_investido: String(i.valor_investido ?? ""),
      valor_atual: String(i.valor_atual ?? ""),
      data_investimento: i.data_investimento,
      rentabilidade: i.rentabilidade ?? "",
      responsavel: i.responsavel ?? "",
      observacoes: i.observacoes ?? "",
      tipo_rendimento: i.tipo_rendimento ?? "",
      percentual_rendimento: i.percentual_rendimento != null ? String(i.percentual_rendimento) : "",
    });
    setOpen(true);
  }

  const responsaveis = [...perfis.map((p: any) => p.nome), RESPONSAVEIS_EXTRA];

  const totalInvestido = investimentos.reduce(
    (s: number, i: any) => s + Number(i.valor_investido),
    0,
  );
  const totalAtual = investimentos.reduce((s: number, i: any) => s + Number(i.valor_atual), 0);
  const rendimento = totalAtual - totalInvestido;

  const porTipo = Object.entries(
    investimentos.reduce((acc: Record<string, number>, i: any) => {
      acc[i.tipo] = (acc[i.tipo] ?? 0) + Number(i.valor_atual);
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value: value as number }));

  const salvar = useMutation({
    mutationFn: async () => {
      const investido = Number(String(form.valor_investido).replace(",", ".")) || 0;
      const parsed = schema.parse({
        nome: form.nome,
        tipo: form.tipo,
        instituicao: form.instituicao || null,
        valor_investido: investido,
        valor_atual: Number(String(form.valor_atual).replace(",", ".")) || investido,
        data_investimento: form.data_investimento,
        rentabilidade: form.rentabilidade || null,
        responsavel: form.responsavel,
        observacoes: form.observacoes || null,
        tipo_rendimento: form.tipo_rendimento || null,
        percentual_rendimento: form.percentual_rendimento
          ? Number(String(form.percentual_rendimento).replace(",", "."))
          : null,
      });
      if (editId) {
        const { error } = await supabase.from("investimentos").update(parsed).eq("id", editId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("investimentos").insert(parsed);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Investimento atualizado" : "Investimento cadastrado");
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message),
  });

  const registrarMov = useMutation({
    mutationFn: async () => {
      if (!mov) return;
      const valor = Number(String(valorMov).replace(",", "."));
      if (!valor || valor <= 0) throw new Error("Informe um valor válido");
      const inv = investimentos.find((i: any) => i.id === mov.id);
      if (!inv) throw new Error("Investimento não encontrado");
      const delta = mov.tipo === "aporte" ? valor : -valor;
      const { error } = await supabase.from("investimento_movimentos").insert({
        investimento_id: mov.id,
        tipo: mov.tipo,
        valor,
        data: toISODate(new Date()),
      });
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("investimentos")
        .update({
          valor_investido: Math.max(0, Number(inv.valor_investido) + delta),
          valor_atual: Math.max(0, Number(inv.valor_atual) + delta),
        })
        .eq("id", mov.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Movimento registrado");
      setMov(null);
      setValorMov("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Investimento excluído");
      qc.invalidateQueries();
    },
  });

  return (
    <AppLayout
      title="Investimentos"
      description="Patrimônio aplicado e rendimento acumulado"
      actions={
        can("investimentos", "editar") && (
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="size-4" /> Novo
          </Button>
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total investido</p>
            <p className="mt-1 text-xl font-bold">{formatBRL(totalInvestido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor atual</p>
            <p className="mt-1 text-xl font-bold">{formatBRL(totalAtual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rendimento</p>
            <p
              className={`mt-1 text-xl font-bold ${rendimento >= 0 ? "text-success" : "text-destructive"}`}
            >
              {formatBRL(rendimento)}
            </p>
          </CardContent>
        </Card>
      </div>

      {porTipo.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Distribuição por tipo</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={porTipo}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                >
                  {porTipo.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {investimentos.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <PiggyBank className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum investimento cadastrado.</p>
            </CardContent>
          </Card>
        )}
        {investimentos.map((i: any) => {
          const lucro = Number(i.valor_atual) - Number(i.valor_investido);
          const pct = Number(i.valor_investido) ? (lucro / Number(i.valor_investido)) * 100 : 0;
          return (
            <Card key={i.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <PiggyBank className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.tipo}
                      {i.instituicao ? ` · ${i.instituicao}` : ""} · desde{" "}
                      {formatDate(i.data_investimento)} · {i.responsavel ?? "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{formatBRL(Number(i.valor_atual))}</p>
                    <p className={`text-xs ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
                      {lucro >= 0 ? "+" : ""}
                      {formatBRL(lucro)} ({pct.toFixed(1)}%)
                    </p>
                  </div>
                  {can("investimentos", "editar") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => abrirEdicao(i)}
                      aria-label="Editar investimento"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {can("investimentos", "excluir") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => excluir.mutate(i.id)}
                      aria-label="Excluir investimento"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {i.rentabilidade && <Badge variant="secondary">{i.rentabilidade}</Badge>}
                  {i.tipo_rendimento && i.percentual_rendimento != null && (
                    <Badge variant="outline">
                      {i.percentual_rendimento}
                      {TIPOS_RENDIMENTO.find((t) => t.value === i.tipo_rendimento)
                        ?.sufixoPercentual ?? ""}
                    </Badge>
                  )}
                  {can("investimentos", "editar") && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMov({ id: i.id, tipo: "aporte" })}
                      >
                        <ArrowUpRight className="size-4" /> Aporte
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMov({ id: i.id, tipo: "resgate" })}
                      >
                        <ArrowDownRight className="size-4" /> Resgate
                      </Button>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {(i.investimento_movimentos ?? []).length} movimento(s)
                  </span>
                </div>
                {i.tipo_rendimento && i.percentual_rendimento != null && (
                  <ProjecaoRendimento
                    valorAtual={Number(i.valor_atual)}
                    tipoRendimento={i.tipo_rendimento as TipoRendimento}
                    percentualRendimento={Number(i.percentual_rendimento)}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditId(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar investimento" : "Novo investimento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Instituição">
              <Input
                value={form.instituicao}
                onChange={(e) => setForm({ ...form, instituicao: e.target.value })}
              />
            </Field>
            <Field label="Valor investido">
              <Input
                inputMode="decimal"
                value={form.valor_investido}
                onChange={(e) => setForm({ ...form, valor_investido: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Valor atual">
              <Input
                inputMode="decimal"
                value={form.valor_atual}
                onChange={(e) => setForm({ ...form, valor_atual: e.target.value })}
                placeholder="Igual ao aplicado se vazio"
              />
            </Field>
            <Field label="Data do investimento">
              <Input
                type="date"
                value={form.data_investimento}
                onChange={(e) => setForm({ ...form, data_investimento: e.target.value })}
              />
            </Field>
            <Field label="Rentabilidade (rótulo livre)">
              <Input
                value={form.rentabilidade}
                onChange={(e) => setForm({ ...form, rentabilidade: e.target.value })}
                placeholder="Ex.: 110% do CDI"
              />
            </Field>
            <Field label="Correção e rendimento">
              <Select
                value={form.tipo_rendimento || "nenhum"}
                onValueChange={(v) =>
                  setForm({ ...form, tipo_rendimento: v === "nenhum" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem cálculo automático</SelectItem>
                  {TIPOS_RENDIMENTO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {form.tipo_rendimento && (
              <Field
                label={
                  TIPOS_RENDIMENTO.find((t) => t.value === form.tipo_rendimento)
                    ?.sufixoPercentual ?? "%"
                }
              >
                <Input
                  inputMode="decimal"
                  value={form.percentual_rendimento}
                  onChange={(e) => setForm({ ...form, percentual_rendimento: e.target.value })}
                  placeholder={form.tipo_rendimento === "cdi" ? "Ex.: 110" : "Ex.: 6"}
                />
              </Field>
            )}
            <Field label="Responsável" className="sm:col-span-2">
              <Select
                value={form.responsavel}
                onValueChange={(v) => setForm({ ...form, responsavel: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {editId ? "Salvar alterações" : "Salvar investimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mov} onOpenChange={(o) => !o && setMov(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{mov?.tipo === "aporte" ? "Novo aporte" : "Resgate"}</DialogTitle>
          </DialogHeader>
          <Field label="Valor">
            <Input
              inputMode="decimal"
              value={valorMov}
              onChange={(e) => setValorMov(e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => registrarMov.mutate()} disabled={registrarMov.isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
