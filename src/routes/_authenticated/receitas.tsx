import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  CreditCard,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { BarraSoma, useSelecaoSoma } from "@/components/BarraSoma";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IndiceReajusteField } from "@/components/IndiceReajusteField";
import { MonthPicker } from "@/components/MonthPicker";
import {
  competenciaDe,
  HORIZONTE_SEM_PRAZO,
  PERIODICIDADES,
  projetarCompetencias,
  receitasPorCompetencias,
  somarMeses,
  type ModoReajuste,
  type Periodicidade,
  type RecorrenciaFixa,
} from "@/lib/recorrencia";
import { correspondeBuscaComValor } from "@/lib/busca";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useCategorias,
  useCartoes,
  useProfilesList,
  useReceitas,
  RESPONSAVEIS_EXTRA,
} from "@/hooks/useFinance";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import { useCotacao } from "@/hooks/useCotacao";
import {
  addMonths,
  currentMonthKey,
  formatBRL,
  formatDate,
  formatMoeda,
  monthKey,
  monthLabelLong,
  toBRL,
  toISODate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Control ALL" },
      {
        name: "description",
        content: "Cadastre e acompanhe salários, freelances e rendimentos do casal por mês.",
      },
      { property: "og:title", content: "Receitas — Control ALL" },
      {
        property: "og:description",
        content: "Controle de receitas recorrentes e avulsas do casal.",
      },
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
  cartao_id: z.string().uuid().nullable(),
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
  cartao_id: "",
  reajuste_tipo: "nenhum" as "nenhum" | ModoReajuste,
  reajuste_percentual: "",
  reajuste_valor_fixo: "",
  reajuste_periodicidade: "anual" as Periodicidade,
  reajuste_indice: "",
  reajuste_inicio: "",
};

function ReceitasPage() {
  const qc = useQueryClient();
  const cotacao = useCotacao();
  const { user } = useSession();
  const { can } = usePermissoes();
  const { data: receitas = [] } = useReceitas();
  const { data: categorias = [] } = useCategorias("receita");
  const { data: cartoes = [] } = useCartoes();
  const { data: perfis = [] } = useProfilesList();
  const { formatar } = usePrivacidadeValores();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [duplicata, setDuplicata] = useState<any | null>(null);
  // Item 3 (backlog 2026-09-27): filtros e modo de exibição lembrados por
  // sessão (localStorage) e restaurados quando o usuário volta pra tela.
  const [tab, setTab] = usePersistedState<"total" | "fixa" | "variavel">("receitas.tab", "total");
  const [filtroMes, setFiltroMes] = usePersistedState("receitas.filtroMes", currentMonthKey());
  const [filtroMesCustom, setFiltroMesCustom] = usePersistedState("receitas.filtroMesCustom", currentMonthKey());
  const [filtroCat, setFiltroCat] = usePersistedState("receitas.filtroCat", "todas");
  const [filtroResp, setFiltroResp] = usePersistedState("receitas.filtroResp", "todos");
  const [busca, setBusca] = useState("");
  const [modoLista, setModoLista] = usePersistedState<"lista" | "cartao">(
    "receitas.modoLista",
    "lista",
  );

  /** 61 meses: 2 anos anteriores, mês atual e 3 anos à frente (igual a despesas) */
  const meses = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 61 }, (_, i) =>
      monthKey(new Date(now.getFullYear(), now.getMonth() + 36 - i, 1)),
    );
  }, []);

  /** Competências a carregar: se o usuário está em um mês específico, só aquele mês! */
  const competenciasParaFiltro = useMemo(() => {
    if (filtroMes === "todos") {
      return meses.slice().reverse();
    }
    if (filtroMes === "custom") {
      return [filtroMesCustom];
    }
    if (filtroMes === "atual_proximo" || !filtroMes) {
      return [currentMonthKey()];
    }
    return [filtroMes];
  }, [filtroMes, filtroMesCustom, meses]);

  const lista = useMemo(() => {
    const projetadas = receitasPorCompetencias(receitas as any[], competenciasParaFiltro);
    return projetadas.filter((r) => {
      if (tab !== "total" && r.tipo !== tab) return false;
      if (filtroCat !== "todas" && r.categoria !== filtroCat) return false;
      if (filtroResp !== "todos" && r.responsavel !== filtroResp) return false;
      if (
        busca &&
        !correspondeBuscaComValor(
          `${r.descricao} ${r.categoria} ${r.responsavel}`,
          Number(r.valor),
          busca,
        )
      )
        return false;
      return true;
    });
  }, [receitas, competenciasParaFiltro, tab, filtroCat, filtroResp, busca]);

  const chips = [
    filtroMes !== currentMonthKey() &&
      filtroMes !== "todos" &&
      filtroMes !== "custom" &&
      filtroMes !== "atual_proximo" && {
        label: monthLabelLong(filtroMes),
        clear: () => setFiltroMes(currentMonthKey()),
      },
    filtroMes === "todos" && {
      label: "Todos os meses",
      clear: () => setFiltroMes(currentMonthKey()),
    },
    filtroMes === "custom" && {
      label: `Mês: ${monthLabelLong(filtroMesCustom)}`,
      clear: () => setFiltroMes(currentMonthKey()),
    },
    tab !== "total" && {
      label: tab === "fixa" ? "Somente fixas" : "Somente variáveis",
      clear: () => setTab("total"),
    },
    filtroCat !== "todas" && { label: filtroCat, clear: () => setFiltroCat("todas") },
    filtroResp !== "todos" && { label: filtroResp, clear: () => setFiltroResp("todos") },
    !!busca && { label: `"${busca}"`, clear: () => setBusca("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  function limparFiltros() {
    setFiltroMes(currentMonthKey());
    setTab("total");
    setFiltroCat("todas");
    setFiltroResp("todos");
    setBusca("");
  }

  const total = lista.reduce(
    (s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao),
    0,
  );

  const primeiroNome = (nome?: string | null) => nome?.trim().split(/\s+/)[0] || "Titular não informado";

  const soma = useSelecaoSoma();
  const totalSelecionadoReceitas = (lista as any[])
    .filter((r) => soma.ids.has(String(r.id)))
    .reduce((t, r) => t + toBRL(Number(r.valor), r.moeda, cotacao), 0);

  const grupos = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of lista as any[]) {
      // usa r.competencia para agrupamento (já vem preenchido pela projeção dinâmica)
      const k = modoLista === "cartao" ? r.cartao_id ?? "sem" : (r.competencia ?? monthKey(r.data_recebimento));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map, ([key, itens]) => ({
      key,
      label:
        modoLista === "cartao"
          ? (() => {
              const cartao: any = cartoes.find((c: any) => c.id === key);
              return cartao
                ? `${cartao.apelido ?? cartao.bandeira ?? "Cartão"} •${cartao.final ?? ""} · ${primeiroNome(cartao.titular)}`
                : "Sem atribuição";
            })()
          : monthLabelLong(key),
      itens: itens.sort(
        (a, b) => new Date(b.data_recebimento).getTime() - new Date(a.data_recebimento).getTime(),
      ),
      total: itens.reduce((s, r) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0),
    })).sort((a, b) =>
      modoLista === "cartao" ? b.total - a.total : b.key.localeCompare(a.key),
    );
  }, [lista, cotacao, modoLista, cartoes]);

  const [fechados, setFechados] = useState<Record<string, boolean>>({});
  const mesAtual = currentMonthKey();
  const estaAberto = (key: string) =>
    fechados[key] === undefined
      ? (modoLista === "lista" ? key === mesAtual : true) || grupos.length === 1
      : !fechados[key];

  /** Item 3 (plano de 2026-10-02, Frente 3): mesmo valor + mesma data já
   * cadastrados exige confirmação explícita antes de deixar entrar um
   * segundo lançamento igual — por padrão só o primeiro é salvo. Mesma
   * trava já existente em `/despesas` (`possivelDuplicata`), aqui em
   * paridade pra receitas (que antes não tinha checagem nenhuma). */
  const possivelDuplicata = useMemo(() => {
    if (editId) return null;
    const valorNum = Number(String(form.valor).replace(",", "."));
    if (!valorNum || !form.data_recebimento) return null;
    return (
      receitas.find(
        (r: any) =>
          Math.abs(Number(r.valor) - valorNum) < 0.01 &&
          r.data_recebimento === form.data_recebimento,
      ) ?? null
    );
  }, [receitas, editId, form.valor, form.data_recebimento]);

  function tentarSalvar() {
    if (possivelDuplicata && !duplicata) {
      setDuplicata(possivelDuplicata);
      return;
    }
    salvar.mutate();
  }

  function abrirNova() {
    setEditId(null);
    setForm(emptyForm);
    setDuplicata(null);
    setOpen(true);
  }

  function abrirEdicao(r: any) {
    if (!can("receitas", "editar")) return;
    setEditId(r.id);
    setDuplicata(null);
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
      cartao_id: r.cartao_id ?? "",
      reajuste_tipo:
        r.reajuste_modo === "fixo" ? "fixo" : r.reajuste_percentual ? "percentual" : "nenhum",
      reajuste_percentual: r.reajuste_percentual ? String(r.reajuste_percentual) : "",
      reajuste_valor_fixo: r.reajuste_valor_fixo ? String(r.reajuste_valor_fixo) : "",
      reajuste_periodicidade: r.reajuste_periodicidade ?? "anual",
      reajuste_indice: r.reajuste_indice ?? "",
      reajuste_inicio: r.reajuste_inicio ?? "",
    });
    setOpen(true);
  }

  const ehMensalRecorrente = form.recorrente && form.frequencia === "mensal";
  const valorDigitado = Number(String(form.valor).replace(",", ".")) || 0;
  const percentualReajuste = Number(String(form.reajuste_percentual).replace(",", ".")) || 0;
  const valorFixoReajuste = Number(String(form.reajuste_valor_fixo).replace(",", ".")) || 0;

  /** Recorrência mensal sem prazo configurada no formulário (só quando frequência = mensal). */
  const recorrencia: RecorrenciaFixa | null = ehMensalRecorrente
    ? {
        valor: valorDigitado,
        inicio: form.data_recebimento,
        semPrazo: true,
        meses: null,
        reajuste:
          form.reajuste_tipo !== "nenhum" &&
          ((form.reajuste_tipo === "percentual" && percentualReajuste !== 0) ||
            (form.reajuste_tipo === "fixo" && valorFixoReajuste !== 0))
            ? {
                modo: form.reajuste_tipo,
                percentual: percentualReajuste,
                valorFixo: valorFixoReajuste,
                periodicidade: form.reajuste_periodicidade,
                inicio: form.reajuste_inicio || null,
                indice: form.reajuste_indice || null,
              }
            : null,
      }
    : null;

  /** Só usada como prévia (badge com o próximo valor reajustado) — a geração real acontece no salvar. */
  const projecaoPreview = useMemo(() => {
    if (!recorrencia || valorDigitado <= 0 || !recorrencia.inicio) return [];
    const inicio = competenciaDe(recorrencia.inicio);
    return projetarCompetencias(recorrencia, inicio, somarMeses(inicio, HORIZONTE_SEM_PRAZO - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ehMensalRecorrente,
    valorDigitado,
    form.data_recebimento,
    form.reajuste_tipo,
    percentualReajuste,
    valorFixoReajuste,
    form.reajuste_periodicidade,
    form.reajuste_inicio,
  ]);
  const proximoReajuste = projecaoPreview.find((c, i) => {
    if (i === 0) return false;
    const anterior = projecaoPreview[i - 1];
    return !!anterior && c.valor !== anterior.valor;
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        ...form,
        valor: Number(String(form.valor).replace(",", ".")),
        frequencia: form.recorrente ? form.frequencia : null,
        observacoes: form.observacoes || null,
        cartao_id: form.cartao_id || null,
      });

      if (editId) {
        const payload: any = {
          ...parsed,
          recorrencia_inicio: recorrencia ? recorrencia.inicio : null,
          recorrencia_sem_prazo: Boolean(recorrencia?.semPrazo),
          recorrencia_meses: recorrencia?.meses ?? null,
          reajuste_modo: recorrencia?.reajuste?.modo ?? null,
          reajuste_percentual:
            recorrencia?.reajuste?.modo === "percentual" ? recorrencia.reajuste.percentual : null,
          reajuste_valor_fixo:
            recorrencia?.reajuste?.modo === "fixo" ? recorrencia.reajuste.valorFixo : null,
          reajuste_periodicidade: recorrencia?.reajuste?.periodicidade ?? null,
          reajuste_indice: recorrencia?.reajuste?.indice ?? null,
          reajuste_inicio: recorrencia?.reajuste?.inicio ?? null,
        };
        const { error } = await supabase.from("receitas").update(payload).eq("id", editId);
        if (error) throw error;
        return;
      }

      const base = { ...parsed, created_by: user?.id ?? null };
      let rows: any[];

      if (recorrencia && parsed.recorrente && parsed.frequencia === "mensal") {
        // Mensal recorrente: salva apenas 1 row indeterminada, projeção dinâmica em tempo real
        rows = [
          {
            ...base,
            recorrencia_inicio: recorrencia.inicio,
            recorrencia_sem_prazo: true,
            recorrencia_meses: null,
            reajuste_modo: recorrencia.reajuste?.modo ?? null,
            reajuste_percentual:
              recorrencia.reajuste?.modo === "percentual" ? recorrencia.reajuste.percentual : null,
            reajuste_valor_fixo:
              recorrencia.reajuste?.modo === "fixo" ? recorrencia.reajuste.valorFixo : null,
            reajuste_periodicidade: recorrencia.reajuste?.periodicidade ?? null,
            reajuste_indice: recorrencia.reajuste?.indice ?? null,
            reajuste_inicio: recorrencia.reajuste?.inicio ?? null,
          },
        ];
      } else if (recorrencia && parsed.recorrente) {
        // Sem prazo com periodicidade anual/semestral
        rows = [
          {
            ...base,
            recorrencia_inicio: recorrencia.inicio,
            recorrencia_sem_prazo: true,
            recorrencia_meses: null,
            reajuste_modo: recorrencia.reajuste?.modo ?? null,
            reajuste_percentual:
              recorrencia.reajuste?.modo === "percentual" ? recorrencia.reajuste.percentual : null,
            reajuste_valor_fixo:
              recorrencia.reajuste?.modo === "fixo" ? recorrencia.reajuste.valorFixo : null,
            reajuste_periodicidade: recorrencia.reajuste?.periodicidade ?? null,
            reajuste_indice: recorrencia.reajuste?.indice ?? null,
            reajuste_inicio: recorrencia.reajuste?.inicio ?? null,
          },
        ];
      } else if (parsed.recorrente) {
        // Semanal/bimestral: mantém o modelo simples anterior (12 ocorrências, valor fixo).
        rows = [base];
        const step = parsed.frequencia === "semanal" ? 0 : 1;
        for (let i = 1; i <= 11; i++) {
          const d =
            parsed.frequencia === "semanal"
              ? new Date(
                  new Date(`${parsed.data_recebimento}T12:00:00`).getTime() + i * 7 * 86400000,
                )
              : addMonths(new Date(`${parsed.data_recebimento}T12:00:00`), i * (step || 1));
          rows.push({ ...base, data_recebimento: toISODate(d) });
        }
      } else {
        rows = [base];
      }

      const { error } = await supabase.from("receitas").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Receita atualizada" : "Receita cadastrada");
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      setDuplicata(null);
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
      description={`${lista.length} lançamento(s) · ${formatar(total)}`}
      actions={
        can("receitas", "editar") && (
          <Button size="sm" onClick={abrirNova} data-tour="nova-receita">
            <Plus className="size-4" /> Nova
          </Button>
        )
      }
    >
      <div className="mb-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="h-10">
              <TabsTrigger value="total" className="px-3.5 py-2 text-xs">
                Total
              </TabsTrigger>
              <TabsTrigger value="fixa" className="px-3.5 py-2 text-xs">
                Fixas
              </TabsTrigger>
              <TabsTrigger value="variavel" className="px-3.5 py-2 text-xs">
                Variáveis
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição, categoria ou responsável"
              className="h-11 pl-9"
            />
          </div>

          <Tabs value={modoLista} onValueChange={(v) => setModoLista(v as "lista" | "cartao")}>
            <TabsList className="h-10">
              <TabsTrigger value="lista" className="gap-1 px-3.5 py-2 text-xs">
                <List className="size-3.5" /> Por mês
              </TabsTrigger>
              <TabsTrigger value="cartao" className="gap-1 px-3.5 py-2 text-xs">
                <CreditCard className="size-3.5" /> Por cartão
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select
            value={filtroMes === "atual_proximo" ? currentMonthKey() : filtroMes}
            onValueChange={setFiltroMes}
          >
            <SelectTrigger className="h-11 text-xs">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              <SelectItem value="custom">Mês específico…</SelectItem>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabelLong(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtroMes === "custom" && (
            <MonthPicker
              value={filtroMesCustom}
              onChange={setFiltroMesCustom}
              ariaLabel="Selecionar mês"
              className="h-11"
            />
          )}
          <Select value={filtroCat} onValueChange={setFiltroCat}>
            <SelectTrigger className="h-11 text-xs">
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
            <SelectTrigger className="h-11 text-xs">
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
      </div>

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={c.clear}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-[11px] font-medium hover:bg-muted"
            >
              {c.label}
              <X className="size-3" />
            </button>
          ))}
          <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        </div>
      )}

      <BarraSoma qtd={soma.ids.size} total={totalSelecionadoReceitas} onLimpar={soma.limpar} />

      <div className="space-y-4">
        {lista.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <TrendingUp className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma receita encontrada.</p>
            </CardContent>
          </Card>
        )}
        {grupos.map((g) => {
          const aberto = estaAberto(g.key);
          return (
            <div key={g.key} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center bg-muted/40 pl-4 hover:bg-muted/60">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={soma.todosMarcados(g.itens.map((r: any) => String(r.id)))}
                  onChange={() => soma.alternarVarios(g.itens.map((r: any) => String(r.id)))}
                  aria-label={`Selecionar todos de ${g.label}`}
                  title="Selecionar tudo deste grupo para somar"
                />
              <button
                type="button"
                onClick={() => setFechados((f) => ({ ...f, [g.key]: aberto }))}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
              >
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "" : "-rotate-90"}`}
                />
                <span className="flex-1 truncate text-sm font-semibold">
                  {g.label}
                </span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {g.itens.length} lançamento{g.itens.length > 1 ? "s" : ""}
                </Badge>
                <span className="shrink-0 text-sm font-bold tabular-nums text-success">
                  {formatar(g.total)}
                </span>
              </button>
              </div>
              {aberto && (
                <div className="divide-y">
                  {g.itens.map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => can("receitas", "editar") && abrirEdicao(r.receitaOriginal ?? r)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30",
                        can("receitas", "editar") && "cursor-pointer",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={soma.ids.has(String(r.id))}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => soma.alternar(String(r.id))}
                        aria-label={`Somar ${r.descricao}`}
                      />
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
                        <TrendingUp className="size-4 text-success" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          <span className="text-primary">{r.responsavel} · </span>
                          {r.descricao}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {r.categoria} · {formatDate(r.data_recebimento)}
                          {r.tipo === "fixa" && " · fixa"}
                          {r.recorrente && r.tipo !== "fixa" ? ` · ${r.frequencia}` : ""}
                          {(r.receitaOriginal?.recorrencia_sem_prazo || r.receitaOriginal?.recorrencia_inicio) ? " · sem prazo" : ""}
                          {r.receitaOriginal?.reajuste_periodicidade
                            ? ` · reajuste ${r.receitaOriginal.reajuste_modo === "fixo" ? "fixo" : "%"} ${r.receitaOriginal.reajuste_periodicidade}`
                            : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-success">
                          {formatar(toBRL(Number(r.valor), r.moeda, cotacao))}
                        </p>
                        {r.moeda === "USD" && (
                          <p className="text-[10px] text-muted-foreground">
                            {formatMoeda(Number(r.valor), "USD")} na cotação
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center">
                        {can("receitas", "editar") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirEdicao(r.receitaOriginal ?? r);
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
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              excluir.mutate(r.receita_id ?? r.id);
                            }}
                            aria-label="Excluir receita"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lista.some((r: any) => r.tipo === "fixa") && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Badge variant="secondary" className="mr-2">
            Receitas fixas
          </Badge>
          Receitas fixas são projetadas dinamicamente para qualquer mês futuro — filtre por um mês
          específico para ver 2029, 2030, etc. Entradas marcadas como <em>projetada</em> são
          calculadas automaticamente; edite a receita original para alterar o valor ou as regras de
          reajuste.
        </p>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditId(null);
            setForm(emptyForm);
            setDuplicata(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar receita" : "Nova receita"}</DialogTitle>
          </DialogHeader>

          {duplicata && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="size-4 text-warning" />
              <AlertTitle className="text-sm">Possível duplicidade</AlertTitle>
              <AlertDescription className="text-xs">
                Já existe “{duplicata.descricao}” de {formatBRL(Number(duplicata.valor))} em{" "}
                {formatDate(duplicata.data_recebimento)}. Clique em salvar novamente para confirmar
                mesmo assim.
              </AlertDescription>
            </Alert>
          )}

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
            <Field label="Cartão de recebimento">
              <Select
                value={form.cartao_id || "sem"}
                onValueChange={(v) => setForm({ ...form, cartao_id: v === "sem" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem">Sem atribuição</SelectItem>
                  {cartoes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.apelido ?? c.bandeira} •{c.final} · {primeiroNome(c.titular)}
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
              {ehMensalRecorrente && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Sem data fim — lançamentos são gerados automaticamente por {HORIZONTE_SEM_PRAZO}{" "}
                  meses à frente.
                </p>
              )}
            </Field>

            {ehMensalRecorrente && (
              <div className="space-y-3 rounded-lg border p-3 sm:col-span-2">
                <p className="text-xs font-medium">Reajuste periódico (opcional)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tipo de reajuste">
                    <Select
                      value={form.reajuste_tipo}
                      onValueChange={(v) => setForm({ ...form, reajuste_tipo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Sem reajuste</SelectItem>
                        <SelectItem value="percentual">Percentual (%)</SelectItem>
                        <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {form.reajuste_tipo !== "nenhum" && (
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
                  )}
                  {form.reajuste_tipo === "percentual" && (
                    <Field label="Percentual de reajuste (%)">
                      <Input
                        inputMode="decimal"
                        value={form.reajuste_percentual}
                        onChange={(e) => setForm({ ...form, reajuste_percentual: e.target.value })}
                        placeholder="Ex.: 4"
                      />
                    </Field>
                  )}
                  {form.reajuste_tipo === "fixo" && (
                    <Field label="Aumento fixo por reajuste (R$)">
                      <Input
                        inputMode="decimal"
                        value={form.reajuste_valor_fixo}
                        onChange={(e) => setForm({ ...form, reajuste_valor_fixo: e.target.value })}
                        placeholder="Ex.: 400,00"
                      />
                    </Field>
                  )}
                  {form.reajuste_tipo !== "nenhum" && (
                    <Field label="Mês do 1º reajuste (opcional)">
                      <Input
                        type="month"
                        value={form.reajuste_inicio}
                        onChange={(e) => setForm({ ...form, reajuste_inicio: e.target.value })}
                      />
                    </Field>
                  )}
                  {form.reajuste_tipo === "percentual" && (
                    <Field label="Índice (opcional)" className="sm:col-span-2">
                      <IndiceReajusteField
                        indice={form.reajuste_indice}
                        onIndiceChange={(v) => setForm({ ...form, reajuste_indice: v })}
                        periodicidade={form.reajuste_periodicidade}
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
                  )}
                </div>
                {proximoReajuste && (
                  <p className="text-xs text-muted-foreground">
                    Ex.: em {monthLabelLong(proximoReajuste.competencia)} o valor passa a{" "}
                    <strong>{formatBRL(proximoReajuste.valor)}</strong>.
                  </p>
                )}
              </div>
            )}

            <Field label="Observações" className="sm:col-span-2">
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={tentarSalvar} disabled={salvar.isPending}>
              {duplicata ? "Salvar mesmo assim" : editId ? "Salvar alterações" : "Salvar receita"}
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
