import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useCategorias, useProfilesList, useReceitas, RESPONSAVEIS_EXTRA } from "@/hooks/useFinance";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import { useCotacao } from "@/hooks/useCotacao";
import { addMonths, formatBRL, formatDate, formatMoeda, monthKey, toBRL, toISODate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Finanças do Casal" },
      {
        name: "description",
        content: "Cadastre e acompanhe salários, freelances e rendimentos do casal por mês.",
      },
      { property: "og:title", content: "Receitas — Finanças do Casal" },
      { property: "og:description", content: "Controle de receitas recorrentes e avulsas do casal." },
    ],
  }),
  component: ReceitasPage,
});

const schema = z.object({
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(120),
  valor: z.number().positive("Valor deve ser maior que zero"),
  moeda: z.enum(["BRL", "USD"]),
  categoria: z.string().min(1, "Selecione a categoria"),
  data_recebimento: z.string().min(10, "Informe a data"),
  recorrente: z.boolean(),
  frequencia: z.string().nullable(),
  responsavel: z.string().min(1, "Informe o responsável"),
  observacoes: z.string().max(500).nullable(),
});

const emptyForm = {
  descricao: "",
  valor: "",
  moeda: "BRL",
  categoria: "",
  data_recebimento: toISODate(new Date()),
  recorrente: false,
  frequencia: "mensal",
  responsavel: "",
  observacoes: "",
};

function ReceitasPage() {
  const qc = useQueryClient();
  const cotacao = useCotacao();
  const { user } = useSession();
  const { can } = usePermissoes();
  const { data: receitas = [] } = useReceitas();
  const { data: categorias = [] } = useCategorias("receita");
  const { data: perfis = [] } = useProfilesList();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroCat, setFiltroCat] = useState("todas");
  const [filtroResp, setFiltroResp] = useState("todos");

  const meses = useMemo(
    () => Array.from(new Set(receitas.map((r: any) => monthKey(r.data_recebimento)))).sort().reverse(),
    [receitas],
  );

  const lista = receitas.filter((r: any) => {
    if (filtroMes !== "todos" && monthKey(r.data_recebimento) !== filtroMes) return false;
    if (filtroCat !== "todas" && r.categoria !== filtroCat) return false;
    if (filtroResp !== "todos" && r.responsavel !== filtroResp) return false;
    return true;
  });

  const total = lista.reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);

  const grupos = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of lista as any[]) {
      const k = monthKey(r.data_recebimento);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map, ([mes, itens]) => ({
      mes,
      itens: itens.sort(
        (a, b) => new Date(b.data_recebimento).getTime() - new Date(a.data_recebimento).getTime(),
      ),
      total: itens.reduce((s, r) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0),
    })).sort((a, b) => b.mes.localeCompare(a.mes));
  }, [lista, cotacao]);

  const [fechados, setFechados] = useState<Record<string, boolean>>({});
  const mesAtual = currentMonthKey();
  const estaAberto = (mes: string) =>
    fechados[mes] === undefined ? mes === mesAtual || grupos.length === 1 : !fechados[mes];


  function abrirNova() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function abrirEdicao(r: any) {
    if (!can("receitas", "editar")) return;
    setEditId(r.id);
    setForm({
      descricao: r.descricao ?? "",
      valor: String(r.valor ?? ""),
      moeda: r.moeda ?? "BRL",
      categoria: r.categoria ?? "",
      data_recebimento: r.data_recebimento,
      recorrente: !!r.recorrente,
      frequencia: r.frequencia ?? "mensal",
      responsavel: r.responsavel ?? "",
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        ...form,
        valor: Number(String(form.valor).replace(",", ".")),
        frequencia: form.recorrente ? form.frequencia : null,
        observacoes: form.observacoes || null,
      });

      if (editId) {
        const { error } = await supabase.from("receitas").update(parsed).eq("id", editId);
        if (error) throw error;
        return;
      }

      const base = { ...parsed, created_by: user?.id ?? null };
      const rows = [base];
      if (parsed.recorrente) {
        const step = parsed.frequencia === "semanal" ? 0 : 1;
        for (let i = 1; i <= 11; i++) {
          const d =
            parsed.frequencia === "semanal"
              ? new Date(new Date(`${parsed.data_recebimento}T12:00:00`).getTime() + i * 7 * 86400000)
              : addMonths(new Date(`${parsed.data_recebimento}T12:00:00`), i * (step || 1));
          rows.push({ ...base, data_recebimento: toISODate(d) });
        }
      }
      const { error } = await supabase.from("receitas").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Receita atualizada" : "Receita cadastrada");
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message ?? "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("receitas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Receita excluída");
      qc.invalidateQueries();
    },
  });

  const responsaveis = [...perfis.map((p: any) => p.nome), RESPONSAVEIS_EXTRA];

  return (
    <AppLayout
      title="Receitas"
      description={`${lista.length} lançamento(s) · ${formatBRL(total)}`}
      actions={
        can("receitas", "editar") && (
          <Button size="sm" onClick={abrirNova}>
            <Plus className="size-4" /> Nova
          </Button>
        )
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger>
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c: any) => (
              <SelectItem key={c.id} value={c.nome}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroResp} onValueChange={setFiltroResp}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos responsáveis</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {lista.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <TrendingUp className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma receita encontrada.</p>
            </CardContent>
          </Card>
        )}
        {lista.map((r: any) => (
          <Card
            key={r.id}
            onClick={() => abrirEdicao(r)}
            className={can("receitas", "editar") ? "cursor-pointer transition-colors hover:border-primary/40" : ""}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
                <TrendingUp className="size-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.descricao}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.categoria} · {formatDate(r.data_recebimento)} · {r.responsavel}
                  {r.recorrente ? ` · ${r.frequencia}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-success">
                  {formatBRL(toBRL(Number(r.valor), r.moeda, cotacao))}
                </p>
                {r.moeda === "USD" && (
                  <p className="text-[11px] text-muted-foreground">
                    {formatMoeda(Number(r.valor), "USD")} na cotação
                  </p>
                )}
              </div>
              {can("receitas", "editar") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicao(r);
                  }}
                  aria-label="Editar receita"
                >
                  <Pencil className="size-4" />
                </Button>
              )}
              {can("receitas", "excluir") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    excluir.mutate(r.id);
                  }}
                  aria-label="Excluir receita"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {lista.some((r: any) => r.recorrente) && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Badge variant="secondary" className="mr-2">
            Recorrentes
          </Badge>
          Lançamentos futuros são gerados automaticamente por 12 ocorrências.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar receita" : "Nova receita"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição" className="sm:col-span-2">
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Salário de agosto"
              />
            </Field>
            <Field label="Valor">
              <Input
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Moeda">
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ Real</SelectItem>
                  <SelectItem value="USD">US$ Dólar</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria">
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c: any) => (
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data de recebimento">
              <Input
                type="date"
                value={form.data_recebimento}
                onChange={(e) => setForm({ ...form, data_recebimento: e.target.value })}
              />
            </Field>
            <Field label="Responsável">
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
            <Field label="Frequência">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.recorrente}
                  onCheckedChange={(v) => setForm({ ...form, recorrente: v })}
                />
                {form.recorrente ? (
                  <Select
                    value={form.frequencia}
                    onValueChange={(v) => setForm({ ...form, frequencia: v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="bimestral">Bimestral</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm text-muted-foreground">Lançamento único</span>
                )}
              </div>
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {editId ? "Salvar alterações" : "Salvar receita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
