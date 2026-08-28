import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { useDespesas, useReceitas } from "@/hooks/useFinance";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Finanças do Casal" },
      {
        name: "description",
        content:
          "Resumo do mês: receitas, despesas, saldo, valor mensalizado das parcelas e dívida total em aberto.",
      },
      { property: "og:title", content: "Dashboard — Finanças do Casal" },
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

  const mesAtual = currentMonthKey();
  const [janela, setJanela] = useState("-6");
  const [mesPie, setMesPie] = useState(mesAtual);
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("categoria");
  const [drill, setDrill] = useState<{ mes: string; grupo?: string } | null>(null);

  const meses = useMemo(() => monthWindow(janela), [janela]);
  const mesesSelecionaveis = useMemo(() => {
    const now = new Date();
    const out: string[] = [];
    for (let i = -12; i <= 24; i++)
      out.push(monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
    return out;
  }, []);

  const parcelas = useMemo(
    () =>
      despesas.flatMap((d: any) => (d.parcelas ?? []).map((p: any) => ({ ...p, despesa: d }))),
    [despesas],
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
      .filter((p: any) => p.despesa.total_parcelas > 1)
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);

    const dividaTotal = parcelas
      .filter((p: any) => !p.paga)
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
      .filter((d: any) => d.total_parcelas > 1)
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
    const cartaoMap = new Map<string, { id: string | null; nome: string; cor: string; valor: number }>();
    for (const p of parcelasMes) {
      const d = p.despesa;
      const id = d.cartao_id ?? null;
      const nome = d.cartoes
        ? `${d.cartoes.apelido || d.cartoes.titular || "Cartão"} •${d.cartoes.final ?? ""}`
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
    const comparativo = Array.from(
      new Set([...atualCat.keys(), ...mediaCat.keys()]),
    )
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
        parcela: `${p.numero}/${p.total}`,
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
        descricao: p.despesa.descricao,
        identificacao: identificacaoDespesa(p.despesa),
        parcela: `${p.numero}/${p.total}`,
        vencimento: p.vencimento,
        paga: p.paga,
        valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      }))
      .sort((a: any, b: any) => b.valor - a.valor);
  }, [drill, parcelas, grupoDe, dados.grupos, cotacao]);

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
        />
        <StatCard
          label="Despesas do mês"
          value={dados.totalDespesas}
          usd={dados.usdDespesas}
          cotacao={cotacao}
          icon={ArrowDownRight}
          tone="destructive"
          hint={`Fixas ${formatBRL(dados.fixas)} · Variáveis ${formatBRL(dados.variaveis)}`}
        />
        <StatCard
          label="Saldo do mês"
          value={dados.saldo}
          icon={Wallet}
          tone={dados.saldo >= 0 ? "success" : "destructive"}
        />
        <StatCard
          label="Taxa de poupança"
          value={dados.saldo}
          icon={PiggyBank}
          tone={dados.taxaPoupanca >= 0 ? "success" : "destructive"}
          display={`${dados.taxaPoupanca.toFixed(0)}%`}
          hint={`Média de despesas na janela: ${formatBRL(dados.mediaDespesas)}`}
        />
        <StatCard
          label="Parcelas mensalizadas"
          value={dados.mensalizado}
          icon={CalendarClock}
          tone="warning"
          hint="Parcelas com vencimento neste mês"
        />
        <StatCard
          label="Dívida total em aberto"
          value={dados.dividaTotal}
          icon={Landmark}
          tone="destructive"
          hint="Tudo que ainda falta quitar"
        />
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Fluxo de caixa mês a mês</CardTitle>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </CardHeader>
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
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
              <Bar dataKey="Receitas" fill="var(--success)" radius={[6, 6, 0, 0]}>
                {dados.meses.length <= 12 && (
                  <LabelList dataKey="Receitas" position="top" fontSize={9} formatter={compact} />
                )}
              </Bar>
              {dados.grupos.map((g, i) => (
                <Bar
                  key={g}
                  dataKey={g}
                  stackId="despesas"
                  fill={corGrupo(g)}
                  className="cursor-pointer"
                  radius={i === dados.grupos.length - 1 ? ([6, 6, 0, 0] as [number, number, number, number]) : 0}
                  onClick={(e: any) => setDrill({ mes: e?.payload?.key, grupo: g })}
                />
              ))}
              {dados.meses.length <= 12 && dados.grupos.length > 0 && (
                <Bar dataKey="Despesas" fill="transparent" stackId="rotulo" legendType="none">
                  <LabelList dataKey="Despesas" position="top" fontSize={9} formatter={compact} />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
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
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
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
              </div>
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

}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className={`size-4 ${toneClass}`} />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <p className="text-xl font-bold tracking-tight">{display ?? formatBRL(value)}</p>
          {delta != null && Number.isFinite(delta) && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                (delta >= 0) === !!deltaGoodUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
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
      </CardContent>
    </Card>
  );
}
