import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  PiggyBank,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/AppLayout";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCotacao } from "@/hooks/useCotacao";
import { useCategorias, useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  currentMonthKey,
  formatBRL,
  formatDate,
  formatUSD,
  identificacaoDespesa,
  monthKey,
  monthLabel,
  monthLabelLong,
  toBRL,
} from "@/lib/format";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Control ALL" },
      {
        name: "description",
        content:
          "Resumo do mês: receitas, despesas, saldo, valor mensalizado das parcelas e dívida total em aberto.",
      },
      { property: "og:title", content: "Dashboard — Control ALL" },
      {
        property: "og:description",
        content: "Resumo financeiro do casal com gráficos de categorias e evolução mensal.",
      },
    ],
  }),
  component: DashboardPage,
});

const PALETA = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.62 0.13 200)",
  "oklch(0.7 0.13 120)",
  "oklch(0.66 0.15 30)",
];

const JANELAS = [
  { value: "-6", label: "Últimos 6 meses" },
  { value: "-12", label: "Últimos 12 meses" },
  { value: "6", label: "Próximos 6 meses" },
  { value: "12", label: "Próximos 12 meses" },
  { value: "24", label: "Próximos 24 meses" },
  { value: "custom", label: "Período personalizado" },
];

/** Gera as chaves de mês da janela escolhida (negativo = passado incluindo o mês atual). */
function monthWindow(janela: string): string[] {
  const n = Number(janela);
  const now = new Date();
  const out: string[] = [];
  if (n < 0) {
    for (let i = -n - 1; i >= 0; i--)
      out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  } else {
    for (let i = 0; i < n; i++)
      out.push(monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  return out;
}

/** Gera as chaves de mês entre `inicio` e `fim` (ambos "YYYY-MM", inclusive). */
function monthRange(inicio: string, fim: string): string[] {
  const [yi, mi] = inicio.split("-").map(Number);
  const [yf, mf] = fim.split("-").map(Number);
  if (!yi || !mi || !yf || !mf) return [];
  const out: string[] = [];
  let y = yi;
  let m = mi;
  // Limite de segurança pra nunca gerar uma janela absurdamente grande
  // (ex.: datas trocadas por engano) — 30 anos de meses é mais que suficiente.
  let guarda = 0;
  while ((y < yf || (y === yf && m <= mf)) && guarda < 360) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    guarda++;
  }
  return out;
}

const compact = (v: any) =>
  Number(v) === 0
    ? ""
    : new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
        Number(v),
      );

type Agrupamento = "categoria" | "tipo" | "responsavel";

const AGRUPAMENTOS: { value: Agrupamento; label: string }[] = [
  { value: "categoria", label: "Por categoria" },
  { value: "tipo", label: "Fixa x variável" },
  { value: "responsavel", label: "Por responsável" },
];

function DashboardPage() {
  const cotacao = useCotacao();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();

  const mesAtual = currentMonthKey();
  const [janela, setJanela] = useState("-6");
  const [mesInicioCustom, setMesInicioCustom] = useState(mesAtual);
  const [mesFimCustom, setMesFimCustom] = useState(mesAtual);
  const [visaoFluxo, setVisaoFluxo] = useState<"ambos" | "receitas" | "despesas">("ambos");
  const [tipoGrafico, setTipoGrafico] = useState<"barras" | "linhas">("barras");
  const [mesPie, setMesPie] = useState(mesAtual);
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("categoria");
  const [drill, setDrill] = useState<{ mes: string; grupo?: string } | null>(null);
  const [editando, setEditando] = useState<any | null>(null);

  const meses = useMemo(() => {
    if (janela === "custom") {
      const inicio = mesInicioCustom <= mesFimCustom ? mesInicioCustom : mesFimCustom;
      const fim = mesInicioCustom <= mesFimCustom ? mesFimCustom : mesInicioCustom;
      return monthRange(inicio, fim);
    }
    return monthWindow(janela);
  }, [janela, mesInicioCustom, mesFimCustom]);

  // Janela usada para calcular parcelas/lançamentos por competência — cobre
  // sempre pelo menos -12..+24 meses (padrão), mas se o período personalizado
  // escolhido for maior que isso, amplia para cobrir o intervalo escolhido.
  const mesesSelecionaveis = useMemo(() => {
    const now = new Date();
    const base: string[] = [];
    for (let i = -12; i <= 24; i++)
      base.push(monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
    if (meses.length === 0) return base;
    const uniao = new Set([...base, ...meses]);
    return Array.from(uniao).sort();
  }, [meses]);

  const parcelas = useMemo(
    () =>
      aplicarRegrasFaturaMes(
        lancamentosPorCompetencias(despesas as any[], mesesSelecionaveis),
        faturasMes as any[],
      ),
    [despesas, mesesSelecionaveis, faturasMes],
  );

  const grupoDe = useMemo(
    () => (p: any) =>
      agrupamento === "categoria"
        ? (p.despesa.categoria ?? "outros")
        : agrupamento === "tipo"
          ? p.despesa.tipo === "fixa"
            ? "Fixa"
            : "Variável"
          : (p.despesa.responsavel ?? "Sem responsável"),
    [agrupamento],
  );

  const dados = useMemo(() => {
    const receitasMes = receitas.filter((r: any) => monthKey(r.data_recebimento) === mesAtual);
    const totalReceitas = receitasMes.reduce(
      (s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao),
      0,
    );
    const usdReceitas = receitasMes
      .filter((r: any) => r.moeda === "USD")
      .reduce((s: number, r: any) => s + Number(r.valor), 0);

    const parcelasMes = parcelas.filter((p: any) => monthKey(p.vencimento) === mesAtual);
    const totalDespesas = parcelasMes.reduce(
      (s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      0,
    );
    const usdDespesas = parcelasMes
      .filter((p: any) => p.despesa.moeda === "USD")
      .reduce((s: number, p: any) => s + Number(p.valor), 0);

    const fixas = parcelasMes
      .filter((p: any) => p.despesa.tipo === "fixa")
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);
    const variaveis = totalDespesas - fixas;

    const mensalizado = parcelasMes
      .filter((p: any) => p.despesa.tipo !== "fixa" && p.despesa.total_parcelas > 1)
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);

    const dividaTotal = parcelas
      .filter((p: any) => !p.paga && p.despesa.tipo !== "fixa")
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);

    const porCategoria = new Map<string, number>();
    for (const p of parcelas.filter((p: any) => monthKey(p.vencimento) === mesPie)) {
      const key = `${p.despesa.categoria} (${p.despesa.tipo === "fixa" ? "fixa" : "variável"})`;
      porCategoria.set(
        key,
        (porCategoria.get(key) ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      );
    }

    // Grupos com maior peso na janela, para as barras empilhadas.
    const pesoGrupo = new Map<string, number>();
    for (const p of parcelas) {
      if (!meses.includes(monthKey(p.vencimento))) continue;
      const g = grupoDe(p);
      pesoGrupo.set(g, (pesoGrupo.get(g) ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao));
    }
    const grupos = Array.from(pesoGrupo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([g]) => g);

    const serie = meses.map((key: string) => {
      const rec = receitas
        .filter((r: any) => monthKey(r.data_recebimento) === key)
        .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
      const linha: any = { mes: monthLabel(key), key, Receitas: Number(rec.toFixed(2)) };
      let des = 0;
      for (const g of grupos) linha[g] = 0;
      linha["Outros grupos"] = 0;
      for (const p of parcelas.filter((p: any) => monthKey(p.vencimento) === key)) {
        const v = toBRL(Number(p.valor), p.despesa.moeda, cotacao);
        des += v;
        const g = grupoDe(p);
        const alvo = grupos.includes(g) ? g : "Outros grupos";
        linha[alvo] = Number((linha[alvo] + v).toFixed(2));
      }
      linha.Despesas = Number(des.toFixed(2));
      linha.Saldo = Number((rec - des).toFixed(2));
      return linha;
    });
    const temOutros = serie.some((l: any) => l["Outros grupos"] > 0);
    const gruposFinais = temOutros ? [...grupos, "Outros grupos"] : grupos;

    const parceladas = despesas
      .filter((d: any) => d.tipo !== "fixa" && d.total_parcelas > 1)
      .map((d: any) => ({
        id: d.id,
        descricao: d.descricao,
        cartao: identificacaoDespesa(d) || "Sem forma de pagamento",
        pagas: (d.parcelas ?? []).filter((p: any) => p.paga).length,
        total: d.total_parcelas,
      }))
      .filter((d: any) => d.pagas < d.total)
      .slice(0, 6);

    const top5 = parcelasMes
      .map((p: any) => ({
        id: p.id,
        descricao: p.despesa.descricao,
        identificacao: identificacaoDespesa(p.despesa),
        valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    const mediaDespesas =
      serie.length > 0 ? serie.reduce((s, l: any) => s + l.Despesas, 0) / serie.length : 0;

    // Mês anterior, para variação percentual nos indicadores.
    const ref = new Date(`${mesAtual}-01T12:00:00`);
    const mesAnterior = monthKey(new Date(ref.getFullYear(), ref.getMonth() - 1, 1));
    const receitasAnt = receitas
      .filter((r: any) => monthKey(r.data_recebimento) === mesAnterior)
      .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
    const despesasAnt = parcelas
      .filter((p: any) => monthKey(p.vencimento) === mesAnterior)
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);

    // Uso por cartão no mês corrente.
    const cartaoMap = new Map<
      string,
      { id: string | null; nome: string; cor: string; valor: number }
    >();
    for (const p of parcelasMes) {
      const d = p.despesa;
      const id = d.cartao_id ?? null;
      const nome = d.cartoes
        ? `${d.cartoes.apelido || "Cartão"} •${d.cartoes.final ?? ""} · ${d.cartoes.titular?.trim().split(/\s+/)[0] || "Titular não informado"}`
        : (d.bancos?.nome ?? d.banco_nome ?? "Sem cartão");
      const key = id ?? nome;
      const item = cartaoMap.get(key) ?? {
        id,
        nome,
        cor: d.cartoes?.cor ?? "var(--muted-foreground)",
        valor: 0,
      };
      item.valor += toBRL(Number(p.valor), d.moeda, cotacao);
      cartaoMap.set(key, item);
    }
    const porCartao = Array.from(cartaoMap.values()).sort((a, b) => b.valor - a.valor);

    // Gasto por responsável no mês.
    const respMap = new Map<string, number>();
    for (const p of parcelasMes) {
      const r = p.despesa.responsavel ?? "Sem responsável";
      respMap.set(r, (respMap.get(r) ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao));
    }
    const porResponsavel = Array.from(respMap, ([nome, valor]) => ({
      nome,
      valor: Number(valor.toFixed(2)),
    })).sort((a, b) => b.valor - a.valor);

    // Categoria: mês atual x média dos 3 meses anteriores.
    const tresMeses = [1, 2, 3].map((i) =>
      monthKey(new Date(ref.getFullYear(), ref.getMonth() - i, 1)),
    );
    const atualCat = new Map<string, number>();
    const mediaCat = new Map<string, number>();
    for (const p of parcelas) {
      const mk = monthKey(p.vencimento);
      const cat = p.despesa.categoria ?? "outros";
      const v = toBRL(Number(p.valor), p.despesa.moeda, cotacao);
      if (mk === mesAtual) atualCat.set(cat, (atualCat.get(cat) ?? 0) + v);
      else if (tresMeses.includes(mk)) mediaCat.set(cat, (mediaCat.get(cat) ?? 0) + v / 3);
    }
    const comparativo = Array.from(new Set([...atualCat.keys(), ...mediaCat.keys()]))
      .map((cat) => ({
        categoria: cat,
        "Mês atual": Number((atualCat.get(cat) ?? 0).toFixed(2)),
        "Média 3 meses": Number((mediaCat.get(cat) ?? 0).toFixed(2)),
      }))
      .sort((a, b) => b["Mês atual"] - a["Mês atual"])
      .slice(0, 6);

    // Próximos vencimentos (30 dias).
    const hoje = new Date();
    const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30);
    const proximos = parcelas
      .filter((p: any) => {
        if (p.paga) return false;
        const v = new Date(`${p.vencimento}T12:00:00`);
        return v >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) && v <= limite;
      })
      .map((p: any) => ({
        id: p.id,
        descricao: p.despesa.descricao,
        identificacao: identificacaoDespesa(p.despesa),
        vencimento: p.vencimento,
        parcela: p.despesa.tipo === "fixa" ? "competência mensal" : `${p.numero}/${p.total}`,
        valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      }))
      .sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 8);

    return {
      totalReceitas,
      totalDespesas,
      usdReceitas,
      usdDespesas,
      saldo: totalReceitas - totalDespesas,
      taxaPoupanca: totalReceitas > 0 ? ((totalReceitas - totalDespesas) / totalReceitas) * 100 : 0,
      fixas,
      variaveis,
      mensalizado,
      dividaTotal,
      mediaDespesas,
      deltaReceitas: receitasAnt > 0 ? ((totalReceitas - receitasAnt) / receitasAnt) * 100 : null,
      deltaDespesas: despesasAnt > 0 ? ((totalDespesas - despesasAnt) / despesasAnt) * 100 : null,
      porCartao,
      porResponsavel,
      comparativo,
      proximos,
      totalProximos: proximos.reduce((s: number, p: any) => s + p.valor, 0),
      pie: Array.from(porCategoria, ([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
      meses: serie,
      grupos: gruposFinais,
      parceladas,
      top5,
    };
  }, [receitas, despesas, parcelas, cotacao, mesAtual, mesPie, meses, grupoDe]);

  const detalhe = useMemo(() => {
    if (!drill) return [];
    return parcelas
      .filter((p: any) => monthKey(p.vencimento) === drill.mes)
      .filter((p: any) => {
        if (!drill.grupo) return true;
        const g = grupoDe(p);
        return drill.grupo === "Outros grupos" ? !dados.grupos.includes(g) : g === drill.grupo;
      })
      .map((p: any) => ({
        id: p.id,
        despesa: p.despesa,
        descricao: p.despesa.descricao,
        identificacao: identificacaoDespesa(p.despesa),
        parcela: p.despesa.tipo === "fixa" ? "competência mensal" : `${p.numero}/${p.total}`,
        vencimento: p.vencimento,
        paga: p.paga,
        valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      }))

      .sort((a: any, b: any) => b.valor - a.valor);
  }, [drill, parcelas, grupoDe, dados.grupos, cotacao]);

  /** Agrupamentos do mês selecionado, do maior para o menor. */
  const agrupamentosMes = useMemo(() => {
    const map = new Map<string, { total: number; itens: number }>();
    for (const p of parcelas.filter((p: any) => monthKey(p.vencimento) === mesPie)) {
      const g = grupoDe(p);
      const atual = map.get(g) ?? { total: 0, itens: 0 };
      atual.total += toBRL(Number(p.valor), p.despesa.moeda, cotacao);
      atual.itens += 1;
      map.set(g, atual);
    }
    const lista = Array.from(map, ([grupo, v]) => ({ grupo, ...v })).sort(
      (a, b) => b.total - a.total,
    );
    const total = lista.reduce((s, g) => s + g.total, 0);
    return { lista, total };
  }, [parcelas, grupoDe, mesPie, cotacao]);

  const corGrupo = (g: string) => PALETA[dados.grupos.indexOf(g) % PALETA.length];

  return (
    <AppLayout
      title="Dashboard"
      description={`Resumo de ${monthLabel(mesAtual)} · USD ${cotacao.toFixed(2)}`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Receitas do mês"
          value={dados.totalReceitas}
          usd={dados.usdReceitas}
          cotacao={cotacao}
          icon={ArrowUpRight}
          tone="success"
          delta={dados.deltaReceitas}
          deltaGoodUp
          to="/receitas"
        />
        <StatCard
          label="Despesas do mês"
          value={dados.totalDespesas}
          usd={dados.usdDespesas}
          cotacao={cotacao}
          icon={ArrowDownRight}
          tone="destructive"
          delta={dados.deltaDespesas}
          hint={`Fixas ${formatBRL(dados.fixas)} · Variáveis ${formatBRL(dados.variaveis)}`}
          to="/despesas"
        />

        {/* "Saldo do mês" e "Taxa de poupança" não têm uma única tela
            equivalente no site (são métricas derivadas de receitas −
            despesas) — o destino mais honesto é o próprio gráfico de fluxo
            de caixa mês a mês, mais abaixo nesta mesma página. */}
        <StatCard
          label="Saldo do mês"
          value={dados.saldo}
          icon={Wallet}
          tone={dados.saldo >= 0 ? "success" : "destructive"}
          href="#fluxo-caixa"
        />
        <StatCard
          label="Taxa de poupança"
          value={dados.saldo}
          icon={PiggyBank}
          tone={dados.taxaPoupanca >= 0 ? "success" : "destructive"}
          display={`${dados.taxaPoupanca.toFixed(0)}%`}
          hint={`Média de despesas na janela: ${formatBRL(dados.mediaDespesas)}`}
          href="#fluxo-caixa"
        />
        <StatCard
          label="Parcelas mensalizadas"
          value={dados.mensalizado}
          icon={CalendarClock}
          tone="warning"
          hint="Parcelas com vencimento neste mês"
          to="/despesas"
          search={{ modo: "cartao" }}
        />
        <StatCard
          label="Dívida total em aberto"
          value={dados.dividaTotal}
          icon={Landmark}
          tone="destructive"
          hint="Tudo que ainda falta quitar"
          to="/despesas"
          search={{ mes: "todos" }}
        />
      </div>

      <Card id="fluxo-caixa" className="mt-4">
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Fluxo de caixa mês a mês</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={visaoFluxo} onValueChange={(v) => setVisaoFluxo(v as typeof visaoFluxo)}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Receitas e despesas</SelectItem>
                <SelectItem value="receitas">Somente receitas</SelectItem>
                <SelectItem value="despesas">Somente despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={tipoGrafico}
              onValueChange={(v) => setTipoGrafico(v as typeof tipoGrafico)}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barras">Barras</SelectItem>
                <SelectItem value="linhas">Linhas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGRUPAMENTOS.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={janela} onValueChange={setJanela}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JANELAS.map((j) => (
                  <SelectItem key={j.value} value={j.value} className="text-xs">
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {janela === "custom" && (
              <div className="flex items-center gap-1.5">
                <MonthPicker
                  value={mesInicioCustom}
                  onChange={setMesInicioCustom}
                  ariaLabel="Mês inicial"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <MonthPicker
                  value={mesFimCustom}
                  onChange={setMesFimCustom}
                  ariaLabel="Mês final"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            {tipoGrafico === "linhas" ? (
              <LineChart data={dados.meses} margin={{ top: 18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} />
                <Tooltip formatter={(v: any, n: any) => [formatBRL(Number(v)), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {visaoFluxo !== "despesas" && (
                  <Line
                    type="monotone"
                    dataKey="Receitas"
                    stroke="var(--success)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                )}
                {visaoFluxo !== "receitas" && (
                  <Line
                    type="monotone"
                    dataKey="Despesas"
                    stroke="var(--destructive)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  name="Saldo Líquido (Receita - Despesa)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                />
              </LineChart>
            ) : (
              <BarChart data={dados.meses} margin={{ top: 18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="mes"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={dados.meses.length > 8 ? -35 : 0}
                  textAnchor={dados.meses.length > 8 ? "end" : "middle"}
                  height={dados.meses.length > 8 ? 46 : 24}
                />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  formatter={(v: any, n: any) => [formatBRL(Number(v)), n]}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {visaoFluxo !== "despesas" && (
                  <Bar dataKey="Receitas" fill="var(--success)" radius={[6, 6, 0, 0]}>
                    {dados.meses.length <= 12 && (
                      <LabelList
                        dataKey="Receitas"
                        position="top"
                        fontSize={9}
                        formatter={compact}
                      />
                    )}
                  </Bar>
                )}
                {visaoFluxo !== "receitas" &&
                  (visaoFluxo === "despesas" ? (
                    <Bar dataKey="Despesas" fill="var(--destructive)" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="Despesas"
                        position="top"
                        fontSize={9}
                        formatter={compact}
                      />
                    </Bar>
                  ) : (
                    dados.grupos.map((g, i) => (
                      <Bar
                        key={g}
                        dataKey={g}
                        stackId="despesas"
                        fill={corGrupo(g)}
                        className="cursor-pointer"
                        radius={
                          i === dados.grupos.length - 1
                            ? ([6, 6, 0, 0] as [number, number, number, number])
                            : 0
                        }
                        onClick={(e: any) => setDrill({ mes: e?.payload?.key, grupo: g })}
                      />
                    ))
                  ))}
                {visaoFluxo === "ambos" && dados.meses.length <= 12 && dados.grupos.length > 0 && (
                  <Bar dataKey="Despesas" fill="transparent" stackId="rotulo" legendType="none">
                    <LabelList dataKey="Despesas" position="top" fontSize={9} formatter={compact} />
                  </Bar>
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Agrupamentos de {monthLabelLong(mesPie)} — maior para menor
          </CardTitle>
          <Select value={mesPie} onValueChange={setMesPie}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesesSelecionaveis.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {agrupamentosMes.lista.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>
          )}
          {agrupamentosMes.lista.map((g) => {
            const pct = agrupamentosMes.total ? (g.total / agrupamentosMes.total) * 100 : 0;
            return (
              <button
                key={g.grupo}
                type="button"
                onClick={() => setDrill({ mes: mesPie, grupo: g.grupo })}
                className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium capitalize">{g.grupo}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatBRL(g.total)}</span>
                </div>
                <Progress value={pct} className="mt-1.5 h-1.5" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {g.itens} lançamento(s) · {pct.toFixed(1)}% do mês
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {drill && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {monthLabelLong(drill.mes)}
              {drill.grupo ? ` · ${drill.grupo}` : ""}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setDrill(null)} aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {detalhe.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem lançamentos aqui.</p>
            )}
            {detalhe.map((d: any) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setEditando(d.despesa)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.descricao}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[d.identificacao, d.parcela, formatDate(d.vencimento)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={d.paga ? "secondary" : "outline"}>
                    {d.paga ? "paga" : "em aberto"}
                  </Badge>
                  <span className="font-semibold tabular-nums">{formatBRL(d.valor)}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
            <Select value={mesPie} onValueChange={setMesPie}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mesesSelecionaveis.map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {monthLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dados.pie.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dados.pie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    label={(e: any) => formatBRL(Number(e.value))}
                    labelLine={false}
                    fontSize={11}
                    className="cursor-pointer"
                    onClick={() => setDrill({ mes: mesPie })}
                  >
                    {dados.pie.map((_, i) => (
                      <Cell key={i} fill={PALETA[i % PALETA.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do saldo</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.meses} margin={{ top: 18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                >
                  {dados.meses.length <= 12 && (
                    <LabelList dataKey="Saldo" position="top" fontSize={9} formatter={compact} />
                  )}
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maiores despesas do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {dados.top5.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem lançamentos neste mês.</p>
            )}
            {dados.top5.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.descricao}</p>
                  {t.identificacao && (
                    <p className="truncate text-xs text-muted-foreground">{t.identificacao}</p>
                  )}
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatBRL(t.valor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parcelamentos em andamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dados.parceladas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum parcelamento ativo.</p>
            )}
            {dados.parceladas.map((p: any) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{p.descricao}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {p.pagas} de {p.total} pagas
                  </Badge>
                </div>
                <Progress value={(p.pagas / p.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">{p.cartao}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gasto por cartão neste mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dados.porCartao.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem lançamentos neste mês.</p>
            )}
            {dados.porCartao.map((c) => {
              const pct = dados.totalDespesas > 0 ? (c.valor / dados.totalDespesas) * 100 : 0;
              const conteudo = (
                <div className="space-y-1.5 rounded-lg border p-3 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.cor }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nome}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {formatBRL(c.valor)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-[11px] text-muted-foreground">
                    {pct.toFixed(0)}% das despesas do mês
                  </p>
                </div>
              );
              return c.id ? (
                <Link key={c.id} to="/despesas" search={{ cartao: c.id }} className="block">
                  {conteudo}
                </Link>
              ) : (
                <div key={c.nome}>{conteudo}</div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quem gastou no mês</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dados.porResponsavel.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.porResponsavel}
                  layout="vertical"
                  margin={{ left: 8, right: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={110}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => formatBRL(Number(v))}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                    {dados.porResponsavel.map((_, i) => (
                      <Cell key={i} fill={PALETA[i % PALETA.length]} />
                    ))}
                    <LabelList dataKey="valor" position="right" fontSize={10} formatter={compact} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias: mês atual x média de 3 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dados.comparativo.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.comparativo} margin={{ top: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="categoria"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} />
                  <Tooltip
                    formatter={(v: any, n: any) => [formatBRL(Number(v)), n]}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Mês atual" fill="var(--primary)" radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="Mês atual"
                      position="top"
                      fontSize={9}
                      formatter={compact}
                    />
                  </Bar>
                  <Bar
                    dataKey="Média 3 meses"
                    fill="var(--muted-foreground)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Próximos 30 dias</CardTitle>
            <Badge variant="secondary">{formatBRL(dados.totalProximos)}</Badge>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {dados.proximos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nada a vencer nos próximos 30 dias.</p>
            )}
            {dados.proximos.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.descricao}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.identificacao, p.parcela, formatDate(p.vencimento)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatBRL(p.valor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <EditarDespesaDialog despesa={editando} onClose={() => setEditando(null)} />
    </AppLayout>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem lançamentos neste mês.
    </div>
  );
}

function StatCard({
  label,
  value,
  usd,
  cotacao,
  icon: Icon,
  tone,
  hint,
  display,
  delta,
  deltaGoodUp,
  to,
  search,
  href,
}: {
  label: string;
  value: number;
  usd?: number;
  cotacao?: number;
  icon: typeof Wallet;
  tone: "success" | "destructive" | "warning";
  hint?: string;
  display?: string;
  delta?: number | null;
  deltaGoodUp?: boolean;
  /** Rota pra onde o card navega ao ser clicado. Sem isso (e sem `href`), o card fica só informativo. */
  to?: string;
  /** Search params da rota de destino (ex.: { modo: "cartao" }). */
  search?: Record<string, string>;
  /** Âncora na própria página (ex.: "#fluxo-caixa"), pra quando o destino natural é um gráfico já visível no dashboard, não outra rota. */
  href?: string;
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <p className="text-xl font-bold tracking-tight">{display ?? formatBRL(value)}</p>
        {delta != null && Number.isFinite(delta) && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              delta >= 0 === !!deltaGoodUp
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta).toFixed(0)}% vs. mês anterior
          </span>
        )}
      </div>
      {!!usd && !!cotacao && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          inclui {formatUSD(usd)} na cotação do dia
        </p>
      )}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </>
  );

  const clicavel = !!to || !!href;
  return (
    <Card className={clicavel ? "overflow-hidden transition-colors hover:bg-muted/40" : "overflow-hidden"}>
      {to ? (
        <Link to={to} {...(search ? { search } : {})} className="block focus-visible:outline-none">
          <CardContent className="p-4">{body}</CardContent>
        </Link>
      ) : href ? (
        <a href={href} className="block focus-visible:outline-none">
          <CardContent className="p-4">{body}</CardContent>
        </a>
      ) : (
        <CardContent className="p-4">{body}</CardContent>
      )}
    </Card>
  );
}

/** Edição rápida de uma despesa direto do dashboard, sem sair da tela. */
function EditarDespesaDialog({ despesa, onClose }: { despesa: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: categorias = [] } = useCategorias("despesa");
  const [form, setForm] = useState({
    descricao: "",
    categoria: "",
    tipo: "variavel",
    responsavel: "",
  });

  useEffect(() => {
    if (!despesa) return;
    setForm({
      descricao: despesa.descricao ?? "",
      categoria: despesa.categoria ?? "",
      tipo: despesa.tipo ?? "variavel",
      responsavel: despesa.responsavel ?? "",
    });
  }, [despesa]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("despesas")
        .update({
          descricao: form.descricao,
          categoria: form.categoria,
          tipo: form.tipo,
          responsavel: form.responsavel || null,
        })
        .eq("id", despesa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      toast.success("Despesa atualizada.");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Não consegui salvar."),
  });

  return (
    <Dialog open={!!despesa} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm({ ...form, categoria: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(categorias as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Input
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
