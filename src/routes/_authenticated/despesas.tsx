import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  identificacaoDespesa,
  monthKey,
  parseDate,
  toBRL,
  toISODate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/despesas")({
  validateSearch: (s: Record<string, unknown>): { cartao?: string } =>
    typeof s['cartao'] === "string" && s['cartao'] ? { cartao: s['cartao'] } : {},
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
    modo_valor: "total",
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

  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [tab, setTab] = useState<"fixa" | "variavel">("fixa");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(novoForm("fixa"));
  const [duplicata, setDuplicata] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroBanco, setFiltroBanco] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [modoLista, setModoLista] = useState<"lista" | "cartao">("lista");
  const [expandida, setExpandida] = useState<string | null>(null);

  const filtroCartao = search.cartao ?? "todos";
  const setFiltroCartao = (v: string) =>
    navigate({
      search: (s: any) => ({ ...s, cartao: v === "todos" ? undefined : v }),
      replace: true,
    });


  const responsaveis = [...perfis.map((p: any) => p.nome), RESPONSAVEIS_EXTRA];

  const valorDigitado = Number(String(form.valor_total).replace(",", ".")) || 0;
  const nParcelas = Math.max(1, Number(form.total_parcelas) || 1);
  // "parcela" = o valor digitado é o de cada parcela; "total" = valor cheio da compra
  const valorNum =
    form.modo_valor === "parcela"
      ? Number((valorDigitado * nParcelas).toFixed(2))
      : valorDigitado;
  const previewParcela = valorNum > 0 ? dividirParcelas(valorNum, nParcelas)[0] ?? 0 : 0;


  const possivelDuplicata = useMemo(() => {
    if (editId) return null;
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
  }, [despesas, editId, form.descricao, form.data_compra, form.pagamento, valorNum]);

  function abrirNova() {
    setEditId(null);
    setForm(novoForm(tab));
    setDuplicata(null);
    setOpen(true);
  }

  function abrirEdicao(d: any) {
    if (!can("despesas", "editar")) return;
    setEditId(d.id);
    setDuplicata(null);
    setForm({
      descricao: d.descricao ?? "",
      valor_total: String(d.valor_total ?? ""),
      modo_valor: "total",

      moeda: d.moeda ?? "BRL",
      categoria: d.categoria ?? "",
      tipo: d.tipo ?? "fixa",
      data_compra: d.data_compra,
      pagamento: d.cartao_id ? `cartao:${d.cartao_id}` : d.banco_id ? `banco:${d.banco_id}` : "",
      total_parcelas: String(d.total_parcelas ?? 1),
      data_primeira_parcela: d.data_primeira_parcela,
      responsavel: d.responsavel ?? "",
      observacoes: d.observacoes ?? "",
    });
    setOpen(true);
  }

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
      const vinculos = {
        cartao_id: tipoPg === "cartao" ? (idPg ?? null) : null,
        banco_id: tipoPg === "banco" ? (idPg ?? null) : null,
      };

      let despesaId = editId;
      if (editId) {
        const { error } = await supabase
          .from("despesas")
          .update({ ...parsed, ...vinculos })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { data: despesa, error } = await supabase
          .from("despesas")
          .insert({ ...parsed, ...vinculos, created_by: user?.id ?? null })
          .select()
          .single();
        if (error) throw error;
        despesaId = despesa.id;
      }

      const pagasAntigas = new Set<number>(
        editId
          ? ((despesas.find((d: any) => d.id === editId)?.parcelas ?? []) as any[])
              .filter((p: any) => p.paga)
              .map((p: any) => p.numero)
          : [],
      );
      if (editId) {
        const { error } = await supabase.from("parcelas").delete().eq("despesa_id", editId);
        if (error) throw error;
      }

      const valores = dividirParcelas(parsed.valor_total, parsed.total_parcelas);
      const base = parseDate(parsed.data_primeira_parcela);
      const parcelas = valores.map((valor, i) => ({
        despesa_id: despesaId!,
        numero: i + 1,
        total: parsed.total_parcelas,
        valor,
        moeda: parsed.moeda,
        vencimento: toISODate(addMonths(base, i)),
        paga: pagasAntigas.has(i + 1),
      }));
      const { error: e2 } = await supabase.from("parcelas").insert(parcelas);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success(editId ? "Despesa atualizada" : "Despesa cadastrada com parcelas geradas");
      setOpen(false);
      setEditId(null);
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

  const moverTipo = useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: "fixa" | "variavel" }) => {
      const { error } = await supabase.from("despesas").update({ tipo }).eq("id", id);
      if (error) throw error;
      return tipo;
    },
    onSuccess: (tipo) => {
      toast.success(`Despesa movida para ${tipo === "fixa" ? "fixas" : "variáveis"}`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível mover"),
  });



  function tentarSalvar() {
    if (possivelDuplicata && !duplicata) {
      setDuplicata(possivelDuplicata);
      return;
    }
    salvar.mutate();
  }

  const meses = useMemo(
    () =>
      Array.from(new Set(despesas.map((d: any) => monthKey(d.data_compra))))
        .sort()
        .reverse(),
    [despesas],
  );

  const formaKey = (d: any) =>
    d.cartao_id ? `cartao:${d.cartao_id}` : d.banco_id ? `banco:${d.banco_id}` : "sem";

  const lista = despesas.filter((d: any) => {
    if (d.tipo !== tab) return false;
    if (filtroMes !== "todos" && monthKey(d.data_compra) !== filtroMes) return false;
    if (filtroCartao !== "todos") {
      if (filtroCartao === "sem" ? !!d.cartao_id : d.cartao_id !== filtroCartao) return false;
    }
    if (filtroBanco !== "todos" && d.banco_id !== filtroBanco) return false;
    if (filtroCategoria !== "todos" && d.categoria !== filtroCategoria) return false;
    if (filtroResponsavel !== "todos" && d.responsavel !== filtroResponsavel) return false;
    if (busca && !`${d.descricao} ${d.categoria} ${d.responsavel}`.toLowerCase().includes(busca.toLowerCase()))
      return false;
    return true;
  });

  const resumo = useMemo(() => {
    let total = 0;
    let pago = 0;
    let aberto = 0;
    let proximo: { data: string; valor: number } | null = null;
    const hoje = toISODate(new Date());
    for (const d of lista as any[]) {
      const brl = (v: number) => toBRL(v, d.moeda, cotacao);
      total += brl(Number(d.valor_total));
      for (const p of d.parcelas ?? []) {
        if (p.paga) pago += brl(Number(p.valor));
        else {
          aberto += brl(Number(p.valor));
          if (p.vencimento >= hoje && (!proximo || p.vencimento < proximo.data))
            proximo = { data: p.vencimento, valor: brl(Number(p.valor)) };
        }
      }
    }
    return { total, pago, aberto, proximo };
  }, [lista, cotacao]);

  /** Agrupa a lista por forma de pagamento (cartão/banco) ou devolve um grupo único. */
  const gruposLista = useMemo(() => {
    if (modoLista === "lista")
      return [{ key: "all", label: "", cor: "", itens: lista as any[], total: resumo.total }];
    const mapa = new Map<string, { key: string; label: string; cor: string; itens: any[]; total: number }>();
    for (const d of lista as any[]) {
      const key = formaKey(d);
      const label = d.cartoes
        ? `${d.cartoes.apelido || d.cartoes.titular || "Cartão"} •${d.cartoes.final ?? ""}`
        : d.bancos?.nome
          ? `${d.bancos.nome} (conta)`
          : (d.banco_nome ?? "Sem forma de pagamento");
      const cor = d.cartoes?.cor ?? "var(--muted-foreground)";
      const g = mapa.get(key) ?? { key, label, cor, itens: [], total: 0 };
      g.itens.push(d);
      g.total += toBRL(Number(d.valor_total), d.moeda, cotacao);
      mapa.set(key, g);
    }
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [lista, modoLista, cotacao, resumo.total]);

  const chips = [
    filtroCartao !== "todos" && {
      label:
        filtroCartao === "sem"
          ? "Sem cartão"
          : (() => {
              const c: any = cartoes.find((c: any) => c.id === filtroCartao);
              return c ? `Cartão ${c.apelido ?? c.bandeira} •${c.final}` : "Cartão";
            })(),
      clear: () => setFiltroCartao("todos"),
    },
    filtroBanco !== "todos" && {
      label: `Banco ${(bancos.find((b: any) => b.id === filtroBanco) as any)?.nome ?? ""}`,
      clear: () => setFiltroBanco("todos"),
    },
    filtroCategoria !== "todos" && {
      label: filtroCategoria,
      clear: () => setFiltroCategoria("todos"),
    },
    filtroResponsavel !== "todos" && {
      label: filtroResponsavel,
      clear: () => setFiltroResponsavel("todos"),
    },
    filtroMes !== "todos" && { label: monthLabelLong(filtroMes), clear: () => setFiltroMes("todos") },
    !!busca && { label: `"${busca}"`, clear: () => setBusca("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  function limparFiltros() {
    setFiltroCartao("todos");
    setFiltroBanco("todos");
    setFiltroCategoria("todos");
    setFiltroResponsavel("todos");
    setFiltroMes("todos");
    setBusca("");
  }

  return (
    <AppLayout
      title="Despesas"
      description={`${lista.length} lançamento(s) · ${formatBRL(resumo.total)}`}
      actions={
        can("despesas", "editar") && (
          <Button size="sm" onClick={abrirNova}>
            <Plus className="size-4" /> Nova
          </Button>
        )
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Total", valor: formatBRL(resumo.total), cor: "text-foreground", hint: "" },
          { label: "Pago", valor: formatBRL(resumo.pago), cor: "text-success", hint: "" },
          { label: "Em aberto", valor: formatBRL(resumo.aberto), cor: "text-destructive", hint: "" },
          {
            label: "Próximo vencimento",
            valor: resumo.proximo ? formatBRL(resumo.proximo.valor) : "—",
            cor: "text-warning",
            hint: resumo.proximo ? formatDate(resumo.proximo.data) : "sem parcelas futuras",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-card px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className={cn("text-sm font-bold tabular-nums", k.cor)}>{k.valor}</p>
            {k.hint && <p className="text-[10px] text-muted-foreground">{k.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "fixa" | "variavel")}>
            <TabsList className="h-9">
              <TabsTrigger value="fixa" className="text-xs">
                Fixas
              </TabsTrigger>
              <TabsTrigger value="variavel" className="text-xs">
                Variáveis
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição, categoria ou responsável"
              className="h-9 pl-8"
            />
          </div>
          <Tabs value={modoLista} onValueChange={(v) => setModoLista(v as "lista" | "cartao")}>
            <TabsList className="h-9">
              <TabsTrigger value="lista" className="gap-1 text-xs">
                <ListIcon className="size-3.5" /> Lista
              </TabsTrigger>
              <TabsTrigger value="cartao" className="gap-1 text-xs">
                <CreditCard className="size-3.5" /> Por cartão
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Cartão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cartões</SelectItem>
              <SelectItem value="sem">Sem cartão</SelectItem>
              {cartoes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.apelido ?? c.bandeira} •{c.final}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroBanco} onValueChange={setFiltroBanco}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Banco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bancos</SelectItem>
              {bancos.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {categorias.map((c: any) => (
                <SelectItem key={c.id} value={c.nome}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabelLong(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={c.clear}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
              >
                {c.label}
                <X className="size-3" />
              </button>
            ))}
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </div>
        )}
      </div>


      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <TrendingDown className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma despesa encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {lista.map((d: any) => {
            const parcelas = [...(d.parcelas ?? [])].sort((a: any, b: any) => a.numero - b.numero);
            const pagas = parcelas.filter((p: any) => p.paga).length;
            const aberta = expandida === d.id;
            return (
              <div key={d.id}>
                <div
                  onClick={() => abrirEdicao(d)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
                    can("despesas", "editar") && "cursor-pointer",
                  )}
                >
                  <div
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: d.cartoes?.cor ?? "var(--muted-foreground)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {identificacaoDespesa(d) && (
                        <span className="text-primary">{identificacaoDespesa(d)} · </span>
                      )}
                      {d.descricao}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {formatDate(d.data_compra)} · {d.categoria}
                      {d.total_parcelas > 1
                        ? ` · ${d.total_parcelas}x de ${formatBRL(
                            toBRL(Number(d.valor_total) / d.total_parcelas, d.moeda, cotacao),
                          )}`
                        : " · à vista"}
                    </p>
                  </div>
                  {d.total_parcelas > 1 && (
                    <Badge variant="secondary" className="hidden shrink-0 text-[10px] sm:inline-flex">
                      {pagas}/{d.total_parcelas} pagas
                    </Badge>
                  )}

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">
                      {formatBRL(toBRL(Number(d.valor_total), d.moeda, cotacao))}
                    </p>
                    {d.moeda === "USD" && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatUSD(Number(d.valor_total))}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {can("despesas", "editar") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          moverTipo.mutate({ id: d.id, tipo: d.tipo === "fixa" ? "variavel" : "fixa" });
                        }}
                        title={d.tipo === "fixa" ? "Mover para variável" : "Mover para fixa"}
                        aria-label={d.tipo === "fixa" ? "Mover para variável" : "Mover para fixa"}
                      >
                        <ArrowLeftRight className="size-4" />
                      </Button>
                    )}
                    {can("despesas", "editar") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirEdicao(d);
                        }}
                        aria-label="Editar despesa"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}

                    {parcelas.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandida(aberta ? null : d.id);
                        }}
                        aria-label="Ver parcelas"
                      >
                        <ChevronDown
                          className={cn("size-4 transition-transform", aberta && "rotate-180")}
                        />
                      </Button>
                    )}
                    {can("despesas", "excluir") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          excluir.mutate(d.id);
                        }}
                        aria-label="Excluir despesa"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {aberta && (
                  <div className="space-y-2 border-t bg-muted/20 px-3 py-2.5">
                    {d.total_parcelas > 1 && (
                      <Progress value={(pagas / d.total_parcelas) * 100} className="h-1.5" />
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {parcelas.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => togglePaga.mutate({ id: p.id, paga: !p.paga })}
                          disabled={!can("despesas", "editar")}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium tabular-nums transition-colors",
                            p.paga
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-border bg-background text-muted-foreground hover:border-primary/40",
                          )}
                          title={`Vence em ${formatDate(p.vencimento)}`}
                        >
                          {p.paga && <CheckCircle2 className="size-3" />}
                          {p.numero}/{p.total} · {formatBRL(Number(p.valor))}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar despesa" : `Nova despesa ${tab === "fixa" ? "fixa" : "variável"}`}
            </DialogTitle>
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
            <Field label={form.modo_valor === "parcela" ? "Valor da parcela" : "Valor total"}>
              <Input
                inputMode="decimal"
                value={form.valor_total}
                onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                placeholder="0,00"
              />
              {nParcelas > 1 && valorNum > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {form.modo_valor === "parcela"
                    ? `Total da compra: ${formatBRL(valorNum)}`
                    : `Cada parcela: ${formatBRL(previewParcela)}`}
                </p>
              )}
            </Field>
            <Field label="O valor digitado é">
              <Select
                value={form.modo_valor}
                onValueChange={(v) => setForm({ ...form, modo_valor: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Valor total da compra</SelectItem>
                  <SelectItem value="parcela">Valor de cada parcela</SelectItem>
                </SelectContent>
              </Select>
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
              {duplicata ? "Salvar mesmo assim" : editId ? "Salvar alterações" : "Salvar despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
