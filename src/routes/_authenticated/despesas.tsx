import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Plus, Trash2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  RESPONSAVEIS_EXTRA,
  useBancos,
  useCartoes,
  useCategorias,
  useDespesas,
  useProfilesList,
} from "@/hooks/useFinance";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import { useCotacao } from "@/hooks/useCotacao";
import {
  addMonths,
  dividirParcelas,
  formatBRL,
  formatDate,
  formatUSD,
  parseDate,
  toBRL,
  toISODate,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas — Finanças do Casal" },
      {
        name: "description",
        content:
          "Despesas fixas e variáveis com parcelamento automático, alerta de duplicidade e controle de parcelas pagas.",
      },
      { property: "og:title", content: "Despesas — Finanças do Casal" },
      {
        property: "og:description",
        content: "Controle de despesas fixas, variáveis e parcelamentos do casal.",
      },
    ],
  }),
  component: DespesasPage,
});

const schema = z.object({
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(120),
  valor_total: z.number().positive("Valor deve ser maior que zero"),
  moeda: z.enum(["BRL", "USD"]),
  categoria: z.string().min(1, "Selecione a categoria"),
  tipo: z.enum(["fixa", "variavel"]),
  data_compra: z.string().min(10, "Informe a data"),
  total_parcelas: z.number().int().min(1, "Número de parcelas obrigatório (mínimo 1)"),
  data_primeira_parcela: z.string().min(10, "Informe a data da 1ª parcela"),
  responsavel: z.string().min(1, "Informe o responsável"),
  observacoes: z.string().max(500).nullable(),
});

function novoForm(tipo: "fixa" | "variavel") {
  return {
    descricao: "",
    valor_total: "",
    moeda: "BRL",
    categoria: "",
    tipo,
    data_compra: toISODate(new Date()),
    pagamento: "",
    total_parcelas: "1",
    data_primeira_parcela: toISODate(new Date()),
    responsavel: "",
    observacoes: "",
  };
}

function DespesasPage() {
  const qc = useQueryClient();
  const cotacao = useCotacao();
  const { user } = useSession();
  const { can } = usePermissoes();
  const { data: despesas = [] } = useDespesas();
  const { data: categorias = [] } = useCategorias("despesa");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const { data: perfis = [] } = useProfilesList();

  const [tab, setTab] = useState<"fixa" | "variavel">("fixa");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(novoForm("fixa"));
  const [duplicata, setDuplicata] = useState<any | null>(null);

  const responsaveis = [...perfis.map((p: any) => p.nome), RESPONSAVEIS_EXTRA];

  const valorNum = Number(String(form.valor_total).replace(",", ".")) || 0;
  const nParcelas = Math.max(1, Number(form.total_parcelas) || 1);
  const previewParcela = valorNum > 0 ? dividirParcelas(valorNum, nParcelas)[0] ?? 0 : 0;

  const possivelDuplicata = useMemo(() => {
    if (!form.descricao && !valorNum) return null;
    const [tipoPg, idPg] = String(form.pagamento).split(":");
    return (
      despesas.find((d: any) => {
        const mesmaDescricao =
          d.descricao.trim().toLowerCase() === String(form.descricao).trim().toLowerCase();
        const valorProximo = Math.abs(Number(d.valor_total) - valorNum) <= valorNum * 0.02;
        const diffDias =
          Math.abs(parseDate(d.data_compra).getTime() - parseDate(form.data_compra).getTime()) /
          86400000;
        const mesmoPagamento =
          (tipoPg === "cartao" && d.cartao_id === idPg) || (tipoPg === "banco" && d.banco_id === idPg);
        return (mesmaDescricao || valorProximo) && diffDias <= 3 && (mesmoPagamento || !idPg);
      }) ?? null
    );
  }, [despesas, form.descricao, form.data_compra, form.pagamento, valorNum]);

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        descricao: form.descricao,
        valor_total: valorNum,
        moeda: form.moeda,
        categoria: form.categoria,
        tipo: form.tipo,
        data_compra: form.data_compra,
        total_parcelas: Number(form.total_parcelas),
        data_primeira_parcela: form.data_primeira_parcela,
        responsavel: form.responsavel,
        observacoes: form.observacoes || null,
      });
      const [tipoPg, idPg] = String(form.pagamento).split(":");
      const { data: despesa, error } = await supabase
        .from("despesas")
        .insert({
          ...parsed,
          cartao_id: tipoPg === "cartao" ? (idPg ?? null) : null,
          banco_id: tipoPg === "banco" ? (idPg ?? null) : null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      const valores = dividirParcelas(parsed.valor_total, parsed.total_parcelas);
      const base = parseDate(parsed.data_primeira_parcela);
      const parcelas = valores.map((valor, i) => ({
        despesa_id: despesa.id,
        numero: i + 1,
        total: parsed.total_parcelas,
        valor,
        moeda: parsed.moeda,
        vencimento: toISODate(addMonths(base, i)),
      }));
      const { error: e2 } = await supabase.from("parcelas").insert(parcelas);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Despesa cadastrada com parcelas geradas");
      setOpen(false);
      setDuplicata(null);
      setForm(novoForm(tab));
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message ?? "Erro ao salvar"),
  });

  const togglePaga = useMutation({
    mutationFn: async ({ id, paga }: { id: string; paga: boolean }) => {
      const { error } = await supabase
        .from("parcelas")
        .update({ paga, data_pagamento: paga ? toISODate(new Date()) : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa excluída");
      qc.invalidateQueries();
    },
  });

  function tentarSalvar() {
    if (possivelDuplicata && !duplicata) {
      setDuplicata(possivelDuplicata);
      return;
    }
    salvar.mutate();
  }

  const lista = despesas.filter((d: any) => d.tipo === tab);

  return (
    <AppLayout
      title="Despesas"
      description="Fixas e variáveis, com parcelamento automático"
      actions={
        can("despesas", "editar") && (
          <Button
            size="sm"
            onClick={() => {
              setForm(novoForm(tab));
              setDuplicata(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Nova
          </Button>
        )
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "fixa" | "variavel")}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="fixa" className="flex-1 sm:flex-none">
            Despesas fixas
          </TabsTrigger>
          <TabsTrigger value="variavel" className="flex-1 sm:flex-none">
            Despesas variáveis
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {lista.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <TrendingDown className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma despesa cadastrada aqui.</p>
              </CardContent>
            </Card>
          )}
          {lista.map((d: any) => {
            const parcelas = [...(d.parcelas ?? [])].sort((a: any, b: any) => a.numero - b.numero);
            const pagas = parcelas.filter((p: any) => p.paga).length;
            return (
              <Card key={d.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                      <TrendingDown className="size-5 text-destructive" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.descricao}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.categoria} · {formatDate(d.data_compra)} · {d.responsavel}
                        {d.cartoes ? ` · ${d.cartoes.apelido ?? "Cartão"} •${d.cartoes.final}` : ""}
                        {d.bancos ? ` · ${d.bancos.nome}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">
                        {formatBRL(toBRL(Number(d.valor_total), d.moeda, cotacao))}
                      </p>
                      {d.moeda === "USD" && (
                        <p className="text-[11px] text-muted-foreground">
                          {formatUSD(Number(d.valor_total))} na cotação
                        </p>
                      )}
                    </div>
                    {can("despesas", "excluir") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => excluir.mutate(d.id)}
                        aria-label="Excluir despesa"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>

                  {d.total_parcelas > 1 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {parcelas[0] ? formatBRL(Number(parcelas[0].valor)) : ""} por parcela
                        </span>
                        <Badge variant="secondary">
                          {pagas} de {d.total_parcelas} pagas
                        </Badge>
                      </div>
                      <Progress value={(pagas / d.total_parcelas) * 100} className="h-2" />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {parcelas.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => togglePaga.mutate({ id: p.id, paga: !p.paga })}
                        disabled={!can("despesas", "editar")}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                          p.paga
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40"
                        }`}
                        title={`Vence em ${formatDate(p.vencimento)}`}
                      >
                        {p.paga && <CheckCircle2 className="size-3" />}
                        {p.numero}/{p.total} · {formatBRL(Number(p.valor))}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova despesa {tab === "fixa" ? "fixa" : "variável"}</DialogTitle>
          </DialogHeader>

          {duplicata && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="size-4 text-warning" />
              <AlertTitle className="text-sm">Possível duplicidade</AlertTitle>
              <AlertDescription className="text-xs">
                Já existe “{duplicata.descricao}” de {formatBRL(Number(duplicata.valor_total))} em{" "}
                {formatDate(duplicata.data_compra)}. Clique em salvar novamente para confirmar mesmo
                assim.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição" className="sm:col-span-2">
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex.: Mercado do mês"
              />
            </Field>
            <Field label="Valor total">
              <Input
                inputMode="decimal"
                value={form.valor_total}
                onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
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
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm({ ...form, categoria: v })}
              >
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
            <Field label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data da compra">
              <Input
                type="date"
                value={form.data_compra}
                onChange={(e) => setForm({ ...form, data_compra: e.target.value })}
              />
            </Field>
            <Field label="Forma de pagamento">
              <Select
                value={form.pagamento}
                onValueChange={(v) => setForm({ ...form, pagamento: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cartão ou banco" />
                </SelectTrigger>
                <SelectContent>
                  {cartoes.map((c: any) => (
                    <SelectItem key={c.id} value={`cartao:${c.id}`}>
                      {c.apelido ?? c.bandeira} •{c.final}
                    </SelectItem>
                  ))}
                  {bancos.map((b: any) => (
                    <SelectItem key={b.id} value={`banco:${b.id}`}>
                      {b.nome} (conta)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Número de parcelas *">
              <Input
                type="number"
                min={1}
                value={form.total_parcelas}
                onChange={(e) => setForm({ ...form, total_parcelas: e.target.value })}
              />
            </Field>
            <Field label="Data da 1ª parcela">
              <Input
                type="date"
                value={form.data_primeira_parcela}
                onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })}
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
            <Field label="Observações" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </Field>
          </div>

          {nParcelas > 1 && valorNum > 0 && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {nParcelas}x de {formatBRL(previewParcela)} — a última parcela recebe o ajuste de
              centavos.
            </p>
          )}

          <DialogFooter>
            <Button onClick={tentarSalvar} disabled={salvar.isPending}>
              {duplicata ? "Salvar mesmo assim" : "Salvar despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
