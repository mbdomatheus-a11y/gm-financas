import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  List as ListIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  X,
  Receipt,
} from "lucide-react";
import { FaturaMesDialog } from "@/components/FaturaMesDialog";
import { IndiceReajusteField } from "@/components/IndiceReajusteField";
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
  useFaturasMes,
  useProfilesList,
} from "@/hooks/useFinance";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import {
  competenciaDe,
  lancamentosPorCompetencias,
  PERIODICIDADES,
  projetarCompetencias,
  somarMeses,
  type Periodicidade,
  type RecorrenciaFixa,
} from "@/lib/recorrencia";
import { useCotacao } from "@/hooks/useCotacao";
import {
  addMonths,
  dividirParcelas,
  formatBRL,
  formatDate,
  formatUSD,
  identificacaoDespesa,
  monthKey,
  monthLabelLong,
  parseDate,
  toBRL,
  toISODate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/despesas")({
  validateSearch: (s: Record<string, unknown>): { cartao?: string } =>
    typeof s["cartao"] === "string" && s["cartao"] ? { cartao: s["cartao"] } : {},
  head: () => ({
    meta: [
      { title: "Despesas — Control ALL" },
      {
        name: "description",
        content:
          "Despesas fixas e variáveis com parcelamento automático, alerta de duplicidade e controle de parcelas pagas.",
      },
      { property: "og:title", content: "Despesas — Control ALL" },
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
    recorrencia_duracao: "sem_prazo",
    recorrencia_meses: "12",
    reajuste_tipo: "nenhum",
    reajuste_percentual: "",
    reajuste_periodicidade: "anual",
    reajuste_indice: "",
    reajuste_inicio: "",
  };
}

/** Horizonte de competências geradas para uma despesa fixa sem prazo. */
const HORIZONTE_SEM_PRAZO = 36;

function DespesasPage() {
  const qc = useQueryClient();
  const cotacao = useCotacao();
  const { user } = useSession();
  const { can } = usePermissoes();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: categorias = [] } = useCategorias("despesa");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const { data: perfis = [] } = useProfilesList();

  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [tab, setTab] = useState<"total" | "fixa" | "variavel">("total");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(novoForm("fixa"));
  const [duplicata, setDuplicata] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroMes, setFiltroMes] = useState(monthKey(new Date()));
  const [filtroBanco, setFiltroBanco] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [modoLista, setModoLista] = useState<"lista" | "cartao">("lista");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);

  const filtroCartao = search.cartao ?? "todos";
  const setFiltroCartao = (v: string) =>
    navigate({
      search: (s: any) => ({ ...s, cartao: v === "todos" ? undefined : v }),
      replace: true,
    });

  const responsaveis = [...perfis.map((p: any) => p.nome), RESPONSAVEIS_EXTRA];

  const valorDigitado = Number(String(form.valor_total).replace(",", ".")) || 0;
  const parcelasInformadas = Math.max(1, Number(form.total_parcelas) || 1);
  const ehFixa = form.tipo === "fixa";
  const semPrazo = ehFixa && form.recorrencia_duracao === "sem_prazo";
  const mesesPrazo = Math.max(1, Number(form.recorrencia_meses) || 1);
  const percentualReajuste = Number(String(form.reajuste_percentual).replace(",", ".")) || 0;

  /** Recorrência configurada no formulário (somente para despesas fixas). */
  const recorrencia: RecorrenciaFixa | null = ehFixa
    ? {
        valor: valorDigitado,
        inicio: form.data_primeira_parcela || form.data_compra,
        semPrazo,
        meses: semPrazo ? null : mesesPrazo,
        reajuste:
          form.reajuste_tipo === "composto" && percentualReajuste !== 0
            ? {
                percentual: percentualReajuste,
                periodicidade: form.reajuste_periodicidade as Periodicidade,
                inicio: form.reajuste_inicio || null,
                indice: form.reajuste_indice || null,
              }
            : null,
      }
    : null;

  /** Competências geradas para a recorrência (horizonte limitado quando sem prazo). */
  const projecao = useMemo(() => {
    if (!recorrencia || valorDigitado <= 0 || !recorrencia.inicio) return [];
    const inicio = competenciaDe(recorrencia.inicio);
    const qtd = recorrencia.semPrazo ? HORIZONTE_SEM_PRAZO : (recorrencia.meses ?? 1);
    return projetarCompetencias(recorrencia, inicio, somarMeses(inicio, qtd - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    valorDigitado,
    ehFixa,
    semPrazo,
    mesesPrazo,
    form.data_primeira_parcela,
    form.data_compra,
    form.reajuste_tipo,
    percentualReajuste,
    form.reajuste_periodicidade,
    form.reajuste_inicio,
  ]);

  const nParcelas = ehFixa ? Math.max(1, projecao.length) : parcelasInformadas;
  // Fixa: o valor gravado é o valor mensal. Variável: valor da parcela x parcelas.
  const valorNum = ehFixa ? valorDigitado : Number((valorDigitado * nParcelas).toFixed(2));
  const previewParcela = valorDigitado;
  const ultimaCompetencia = projecao.at(-1);

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
          (tipoPg === "cartao" && d.cartao_id === idPg) ||
          (tipoPg === "banco" && d.banco_id === idPg);
        return (mesmaDescricao || valorProximo) && diffDias <= 3 && (mesmoPagamento || !idPg);
      }) ?? null
    );
  }, [despesas, editId, form.descricao, form.data_compra, form.pagamento, valorNum]);

  function abrirNova() {
    setEditId(null);
    setForm(novoForm(tab === "total" ? "variavel" : tab));
    setDuplicata(null);
    setOpen(true);
  }

  function abrirEdicao(d: any) {
    if (!can("despesas", "editar")) return;
    setEditId(d.id);
    setDuplicata(null);
    const n = Math.max(1, Number(d.total_parcelas) || 1);
    const fixa = (d.tipo ?? "fixa") === "fixa";
    // Fixa nova já grava o valor mensal; registros antigos guardavam o total.
    const mensal = d.recorrencia_inicio
      ? Number(d.valor_total ?? 0)
      : Number((Number(d.valor_total ?? 0) / n).toFixed(2));
    setForm({
      ...novoForm(d.tipo ?? "fixa"),
      descricao: d.descricao ?? "",
      valor_total: String(fixa ? mensal : Number((Number(d.valor_total ?? 0) / n).toFixed(2))),
      moeda: d.moeda ?? "BRL",
      categoria: d.categoria ?? "",
      tipo: d.tipo ?? "fixa",
      data_compra: d.data_compra,
      pagamento: d.cartao_id ? `cartao:${d.cartao_id}` : d.banco_id ? `banco:${d.banco_id}` : "",
      total_parcelas: fixa ? "1" : String(n),
      data_primeira_parcela: d.recorrencia_inicio ?? d.data_primeira_parcela,
      responsavel: d.responsavel ?? "",
      observacoes: d.observacoes ?? "",
      recorrencia_duracao: d.recorrencia_meses ? "prazo" : "sem_prazo",
      recorrencia_meses: String(d.recorrencia_meses ?? 12),
      reajuste_tipo: d.reajuste_percentual ? "composto" : "nenhum",
      reajuste_percentual: d.reajuste_percentual ? String(d.reajuste_percentual) : "",
      reajuste_periodicidade: d.reajuste_periodicidade ?? "anual",
      reajuste_indice: d.reajuste_indice ?? "",
      reajuste_inicio: d.reajuste_inicio ?? "",
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
        total_parcelas: nParcelas,
        data_primeira_parcela: form.data_primeira_parcela,
        responsavel: form.responsavel,
        observacoes: form.observacoes || null,
      });
      const [tipoPg, idPg] = String(form.pagamento).split(":");
      const vinculos = {
        cartao_id: tipoPg === "cartao" ? (idPg ?? null) : null,
        banco_id: tipoPg === "banco" ? (idPg ?? null) : null,
        recorrencia_inicio: ehFixa ? parsed.data_primeira_parcela : null,
        recorrencia_sem_prazo: ehFixa ? semPrazo : false,
        recorrencia_meses: ehFixa && !semPrazo ? mesesPrazo : null,
        reajuste_percentual: recorrencia?.reajuste?.percentual ?? null,
        reajuste_periodicidade: recorrencia?.reajuste?.periodicidade ?? null,
        reajuste_indice: recorrencia?.reajuste?.indice ?? null,
        reajuste_inicio: recorrencia?.reajuste?.inicio ?? null,
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

      const antigas = editId
        ? ((despesas.find((d: any) => d.id === editId)?.parcelas ?? []) as any[])
        : [];
      const pagasPorNumero = new Set<number>(
        antigas.filter((p: any) => p.paga).map((p: any) => p.numero),
      );
      // Na recorrência o pagamento pertence à competência, não ao número da parcela.
      const pagasPorCompetencia = new Map<string, string | null>(
        antigas
          .filter((p: any) => p.paga)
          .map((p: any) => [competenciaDe(p.vencimento), p.data_pagamento ?? null]),
      );
      if (editId) {
        const { error } = await supabase.from("parcelas").delete().eq("despesa_id", editId);
        if (error) throw error;
      }

      const base = parseDate(parsed.data_primeira_parcela);
      const parcelas = ehFixa
        ? projecao.map((c, i) => ({
            despesa_id: despesaId!,
            numero: i + 1,
            total: projecao.length,
            valor: c.valor,
            moeda: parsed.moeda,
            vencimento: toISODate(addMonths(base, i)),
            paga: pagasPorCompetencia.has(c.competencia),
            data_pagamento: pagasPorCompetencia.get(c.competencia) ?? null,
          }))
        : dividirParcelas(parsed.valor_total, parsed.total_parcelas).map((valor, i) => ({
            despesa_id: despesaId!,
            numero: i + 1,
            total: parsed.total_parcelas,
            valor,
            moeda: parsed.moeda,
            vencimento: toISODate(addMonths(base, i)),
            paga: pagasPorNumero.has(i + 1),
            data_pagamento: null,
          }));
      const { error: e2 } = await supabase.from("parcelas").insert(parcelas);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success(editId ? "Despesa atualizada" : "Despesa cadastrada com parcelas geradas");
      setOpen(false);
      setEditId(null);
      setDuplicata(null);
      setForm(novoForm(tab === "total" ? "variavel" : tab));
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

  /** Marca/desmarca em lote todas as parcelas de um conjunto de despesas na competência filtrada
   * (usado tanto para "marcar fatura importada como paga" quanto para lançamentos fixos/variáveis). */
  const marcarLote = useMutation({
    mutationFn: async ({ ids, paga }: { ids: string[]; paga: boolean }) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("parcelas")
        .update({ paga, data_pagamento: paga ? toISODate(new Date()) : null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.paga
          ? `${vars.ids.length} lançamento(s) marcado(s) como pago(s)`
          : `${vars.ids.length} lançamento(s) marcado(s) como em aberto`,
      );
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível atualizar os lançamentos"),
  });

  /** Ids reais de parcela (ignora ocorrências projetadas sem linha no banco ainda) das despesas
   * informadas, na competência filtrada, filtrando por status atual de pagamento. */
  function idsDoLote(despesasDoGrupo: any[], statusAlvo: "abertas" | "pagas"): string[] {
    if (filtroMes === "todos") return [];
    const ids: string[] = [];
    for (const d of despesasDoGrupo) {
      const parcelasDoMes = lancamentosDoFiltro.filter((p) => p.despesa_id === d.id);
      for (const p of parcelasDoMes) {
        if (p.projetada) continue;
        if (statusAlvo === "abertas" && p.paga) continue;
        if (statusAlvo === "pagas" && !p.paga) continue;
        ids.push(String(p.id));
      }
    }
    return ids;
  }

  function tentarSalvar() {
    if (possivelDuplicata && !duplicata) {
      setDuplicata(possivelDuplicata);
      return;
    }
    salvar.mutate();
  }

  const meses = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 61 }, (_, i) =>
      monthKey(new Date(now.getFullYear(), now.getMonth() + 36 - i, 1)),
    );
  }, []);

  const lancamentosDoFiltro = useMemo(
    () => (filtroMes === "todos" ? [] : lancamentosPorCompetencias(despesas as any[], [filtroMes])),
    [despesas, filtroMes],
  );
  const lancamentoPorDespesa = useMemo(
    () => new Map(lancamentosDoFiltro.map((p) => [p.despesa_id, p])),
    [lancamentosDoFiltro],
  );

  const formaKey = (d: any) => (d.cartao_id ? `cartao:${d.cartao_id}` : "sem");
  const primeiroNome = (nome?: string | null) =>
    nome?.trim().split(/\s+/)[0] || "Titular não informado";

  const lista = despesas.filter((d: any) => {
    if (tab !== "total" && d.tipo !== tab) return false;
    if (filtroMes !== "todos" && !lancamentoPorDespesa.has(d.id)) return false;
    if (filtroCartao !== "todos") {
      if (filtroCartao === "sem" ? !!d.cartao_id : d.cartao_id !== filtroCartao) return false;
    }
    if (filtroBanco !== "todos" && d.banco_id !== filtroBanco) return false;
    if (filtroCategoria !== "todos" && d.categoria !== filtroCategoria) return false;
    if (filtroResponsavel !== "todos" && d.responsavel !== filtroResponsavel) return false;
    if (
      busca &&
      !`${d.descricao} ${d.categoria} ${d.responsavel}`.toLowerCase().includes(busca.toLowerCase())
    )
      return false;
    return true;
  });

  const valorVisivel = (d: any) =>
    filtroMes === "todos"
      ? Number(d.valor_total)
      : Number(lancamentoPorDespesa.get(d.id)?.valor ?? 0);

  const idsIgnoradosPorTotal = useMemo(() => {
    if (filtroMes === "todos") return new Set<string>();
    const ids = new Set<string>();
    for (const f of faturasMes as any[]) {
      if (f.competencia !== filtroMes || f.modo_calculo !== "somente_total") continue;
      for (const d of despesas as any[]) {
        if (d.cartao_id !== f.cartao_id) continue;
        const ehResumo = d.id === f.despesa_avulsa_id;
        if (f.status === "aberta" ? !ehResumo : ehResumo) ids.add(d.id);
      }
    }
    return ids;
  }, [faturasMes, despesas, filtroMes]);

  const listaVisivel = lista.filter((d: any) => !idsIgnoradosPorTotal.has(d.id));

  const resumo = useMemo(() => {
    let total = 0;
    let pago = 0;
    let aberto = 0;
    let proximo: { data: string; valor: number } | null = null;
    const hoje = toISODate(new Date());
    for (const d of listaVisivel as any[]) {
      const brl = (v: number) => toBRL(v, d.moeda, cotacao);
      const parcelasVisiveis =
        filtroMes === "todos"
          ? (d.parcelas ?? [])
          : lancamentosDoFiltro.filter((p) => p.despesa_id === d.id);
      total += brl(valorVisivel(d));
      for (const p of parcelasVisiveis) {
        if (p.paga) pago += brl(Number(p.valor));
        else {
          aberto += brl(Number(p.valor));
          if (p.vencimento >= hoje && (!proximo || p.vencimento < proximo.data))
            proximo = { data: p.vencimento, valor: brl(Number(p.valor)) };
        }
      }
    }
    return { total, pago, aberto, proximo };
  }, [listaVisivel, cotacao, filtroMes, lancamentosDoFiltro, lancamentoPorDespesa]);

  /** Agrupa por cartão. Tudo que não veio de cartão fica em Sem atribuição. */
  const gruposLista = useMemo(() => {
    if (modoLista === "lista")
      return [
        { key: "all", label: "", cor: "", itens: listaVisivel as any[], total: resumo.total },
      ];
    const mapa = new Map<
      string,
      { key: string; label: string; cor: string; itens: any[]; total: number }
    >();
    for (const d of listaVisivel as any[]) {
      const key = formaKey(d);
      const label = d.cartoes
        ? `${d.cartoes.apelido || d.cartoes.bandeira || "Cartão"} •${d.cartoes.final ?? ""} · ${primeiroNome(d.cartoes.titular)}`
        : "Sem atribuição";
      const cor = d.cartoes?.cor ?? "var(--muted-foreground)";
      const g = mapa.get(key) ?? { key, label, cor, itens: [] as any[], total: 0 };
      g.itens.push(d);
      g.total += toBRL(valorVisivel(d), d.moeda, cotacao);
      mapa.set(key, g);
    }
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [listaVisivel, modoLista, cotacao, resumo.total, filtroMes, lancamentoPorDespesa]);

  const chips = [
    filtroCartao !== "todos" && {
      label:
        filtroCartao === "sem"
          ? "Sem atribuição"
          : (() => {
              const c: any = cartoes.find((c: any) => c.id === filtroCartao);
              return c
                ? `Cartão ${c.apelido ?? c.bandeira} •${c.final} · ${primeiroNome(c.titular)}`
                : "Cartão";
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
    filtroMes !== "todos" && {
      label: monthLabelLong(filtroMes),
      clear: () => setFiltroMes("todos"),
    },
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
          <div className="flex items-center gap-2">
            <FaturaMesDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Receipt className="size-4" /> Fatura do mês
                </Button>
              }
            />
            <Button size="sm" onClick={abrirNova}>
              <Plus className="size-4" /> Nova
            </Button>
          </div>
        )
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Total", valor: formatBRL(resumo.total), cor: "text-foreground", hint: "" },
          { label: "Pago", valor: formatBRL(resumo.pago), cor: "text-success", hint: "" },
          {
            label: "Em aberto",
            valor: formatBRL(resumo.aberto),
            cor: "text-destructive",
            hint: "",
          },
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="h-9">
              <TabsTrigger value="total" className="text-xs">
                Total
              </TabsTrigger>
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
              <SelectItem value="sem">Sem atribuição</SelectItem>
              {cartoes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.apelido ?? c.bandeira} •{c.final} · {primeiroNome(c.titular)}
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

      {modoLista === "lista" &&
        filtroMes !== "todos" &&
        can("despesas", "editar") &&
        lista.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {tab === "total" ? "Todas" : tab === "fixa" ? "Fixas" : "Variáveis"} de{" "}
              {monthLabelLong(filtroMes)}:
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={marcarLote.isPending || idsDoLote(lista, "abertas").length === 0}
              onClick={() => marcarLote.mutate({ ids: idsDoLote(lista, "abertas"), paga: true })}
            >
              <CheckCircle2 className="size-3.5" /> Marcar todas pagas
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={marcarLote.isPending || idsDoLote(lista, "pagas").length === 0}
              onClick={() => marcarLote.mutate({ ids: idsDoLote(lista, "pagas"), paga: false })}
            >
              Desfazer todas
            </Button>
          </div>
        )}

      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <TrendingDown className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma despesa encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gruposLista.map((grupo) => (
            <div key={grupo.key} className="overflow-hidden rounded-xl border bg-card">
              {modoLista === "cartao" && (
                <div
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-center gap-3 border-b bg-muted/30 px-3 py-2 text-left"
                  onClick={() => setGrupoExpandido(grupoExpandido === grupo.key ? null : grupo.key)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    setGrupoExpandido(grupoExpandido === grupo.key ? null : grupo.key)
                  }
                >
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: grupo.cor }}
                  >
                    <CreditCard className="size-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{grupo.label}</p>
                    <Progress
                      value={resumo.total > 0 ? (grupo.total / resumo.total) * 100 : 0}
                      className="mt-1 h-1.5"
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">{formatBRL(grupo.total)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {grupo.itens.length} lançamento(s) ·{" "}
                      {resumo.total > 0 ? ((grupo.total / resumo.total) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                  {can("despesas", "editar") && filtroMes !== "todos" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 text-xs"
                      disabled={
                        marcarLote.isPending || idsDoLote(grupo.itens, "abertas").length === 0
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        marcarLote.mutate({ ids: idsDoLote(grupo.itens, "abertas"), paga: true });
                      }}
                      aria-label="Marcar fatura importada como paga"
                    >
                      <CheckCircle2 className="size-3.5" /> Marcar fatura paga
                    </Button>
                  )}
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      grupoExpandido === grupo.key && "rotate-180",
                    )}
                  />
                </div>
              )}
              {(modoLista !== "cartao" || grupoExpandido === grupo.key) && (
                <div className="divide-y">
                  {grupo.itens.map((d: any) => {
                    const parcelas = [
                      ...(filtroMes === "todos"
                        ? (d.parcelas ?? [])
                        : lancamentosDoFiltro.filter((p) => p.despesa_id === d.id)),
                    ].sort((a: any, b: any) => a.numero - b.numero);
                    const pagas = parcelas.filter((p: any) => p.paga).length;
                    const aberta = expandida === d.id;
                    return (
                      <div key={d.id}>
                        <div
                          onClick={() => abrirEdicao(d)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
                            can("despesas", "editar") && "cursor-pointer",
                            d.origem === "fatura_total_concluida" && "opacity-70 line-through",
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
                              {d.tipo === "fixa"
                                ? ` · ${filtroMes === "todos" ? "valor mensal" : monthLabelLong(filtroMes)}`
                                : d.total_parcelas > 1
                                  ? ` · ${d.total_parcelas}x de ${formatBRL(
                                      toBRL(
                                        Number(d.valor_total) / d.total_parcelas,
                                        d.moeda,
                                        cotacao,
                                      ),
                                    )}`
                                  : " · à vista"}
                            </p>
                          </div>
                          {d.tipo !== "fixa" && d.total_parcelas > 1 && (
                            <div className="hidden w-24 shrink-0 sm:block">
                              <Badge variant="secondary" className="text-[10px]">
                                {d.tipo === "fixa" && filtroMes !== "todos"
                                  ? parcelas[0]?.paga
                                    ? "paga no mês"
                                    : "em aberto no mês"
                                  : `${pagas}/${d.total_parcelas} pagas`}
                              </Badge>
                              <Progress
                                value={(pagas / d.total_parcelas) * 100}
                                className="mt-1 h-1"
                              />
                            </div>
                          )}

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold tabular-nums">
                              {formatBRL(toBRL(valorVisivel(d), d.moeda, cotacao))}
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
                                  moverTipo.mutate({
                                    id: d.id,
                                    tipo: d.tipo === "fixa" ? "variavel" : "fixa",
                                  });
                                }}
                                title={
                                  d.tipo === "fixa" ? "Mover para variável" : "Mover para fixa"
                                }
                                aria-label={
                                  d.tipo === "fixa" ? "Mover para variável" : "Mover para fixa"
                                }
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
                                  className={cn(
                                    "size-4 transition-transform",
                                    aberta && "rotate-180",
                                  )}
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
                                  if (
                                    d.origem === "fatura_total_concluida" &&
                                    !window.confirm("Excluir este total concluído do histórico?")
                                  )
                                    return;
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
                            {d.tipo !== "fixa" && d.total_parcelas > 1 && (
                              <Progress
                                value={(pagas / d.total_parcelas) * 100}
                                className="h-1.5"
                              />
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
                                  {d.tipo === "fixa"
                                    ? monthLabelLong(monthKey(p.vencimento))
                                    : `${p.numero}/${p.total}`}{" "}
                                  · {formatBRL(Number(p.valor))}
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
            </div>
          ))}
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
            <Field label="Valor">
              <Input
                inputMode="decimal"
                value={form.valor_total}
                onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                placeholder="0,00"
              />
              {valorDigitado > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {ehFixa
                    ? `${formatBRL(valorDigitado)} por mês`
                    : nParcelas > 1
                      ? `${nParcelas}x de ${formatBRL(previewParcela)} — total ${formatBRL(valorNum)}`
                      : ""}
                </p>
              )}
            </Field>
            {ehFixa ? (
              <Field label="Duração">
                <Select
                  value={form.recorrencia_duracao}
                  onValueChange={(v) => setForm({ ...form, recorrencia_duracao: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_prazo">Sem prazo</SelectItem>
                    <SelectItem value="prazo">Prazo determinado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            {ehFixa && !semPrazo && (
              <Field label="Parcelas/Meses">
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={form.recorrencia_meses}
                  onChange={(e) => setForm({ ...form, recorrencia_meses: e.target.value })}
                />
              </Field>
            )}

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
                      {c.apelido ?? c.bandeira} •{c.final} · {primeiroNome(c.titular)}
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
            {!ehFixa && (
              <Field label="Número de parcelas *">
                <Input
                  type="number"
                  min={1}
                  value={form.total_parcelas}
                  onChange={(e) => setForm({ ...form, total_parcelas: e.target.value })}
                />
              </Field>
            )}
            <Field label={ehFixa ? "Data de início" : "Data da 1ª parcela"}>
              <Input
                type="date"
                value={form.data_primeira_parcela}
                onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })}
              />
            </Field>
            {ehFixa && (
              <Field label="Reajuste" className="sm:col-span-2">
                <Select
                  value={form.reajuste_tipo}
                  onValueChange={(v) => setForm({ ...form, reajuste_tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem reajuste</SelectItem>
                    <SelectItem value="composto">Reajuste composto periódico</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {ehFixa && form.reajuste_tipo === "composto" && (
              <>
                <Field label="Percentual (%)">
                  <Input
                    inputMode="decimal"
                    placeholder="Ex.: 5"
                    value={form.reajuste_percentual}
                    onChange={(e) => setForm({ ...form, reajuste_percentual: e.target.value })}
                  />
                </Field>
                <Field label="Periodicidade">
                  <Select
                    value={form.reajuste_periodicidade}
                    onValueChange={(v) => setForm({ ...form, reajuste_periodicidade: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODICIDADES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Índice (opcional)">
                  <IndiceReajusteField
                    indice={form.reajuste_indice}
                    onIndiceChange={(v) => setForm({ ...form, reajuste_indice: v })}
                    periodicidade={form.reajuste_periodicidade as Periodicidade}
                    onValorBuscado={(percentual) =>
                      setForm({
                        ...form,
                        reajuste_percentual: String(percentual).replace(".", ","),
                      })
                    }
                    onMediaMensalBuscada={(percentual) =>
                      setForm({
                        ...form,
                        reajuste_periodicidade: "mensal",
                        reajuste_percentual: String(percentual).replace(".", ","),
                      })
                    }
                  />
                </Field>
                <Field label="1º reajuste em">
                  <Input
                    type="date"
                    value={form.reajuste_inicio}
                    onChange={(e) => setForm({ ...form, reajuste_inicio: e.target.value })}
                  />
                </Field>
              </>
            )}
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

          {valorDigitado > 0 && (ehFixa || nParcelas > 1) && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {ehFixa
                ? `${formatBRL(valorDigitado)} por mês a partir de ${monthLabelLong(competenciaDe(form.data_primeira_parcela || form.data_compra))}` +
                  (semPrazo
                    ? ", sem prazo."
                    : ` até ${monthLabelLong(ultimaCompetencia?.competencia ?? "")} (${mesesPrazo} meses).`) +
                  (recorrencia?.reajuste
                    ? ` Reajuste ${recorrencia.reajuste.periodicidade} de ${recorrencia.reajuste.percentual}%${recorrencia.reajuste.indice ? ` (${recorrencia.reajuste.indice})` : ""} — último mês projetado: ${formatBRL(ultimaCompetencia?.valor ?? valorDigitado)}.`
                    : "")
                : `${nParcelas}x de ${formatBRL(previewParcela)} — total ${formatBRL(valorNum)}.`}
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
