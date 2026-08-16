import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  Wallet,
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
  formatUSD,
  monthKey,
  monthLabel,
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

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.6 0.12 200)",
  "oklch(0.7 0.13 120)",
];

function DashboardPage() {
  const cotacao = useCotacao();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();

  const mesAtual = currentMonthKey();
  const [janela, setJanela] = useState("-6");
  const [mesPie, setMesPie] = useState(mesAtual);

  const meses = useMemo(() => monthWindow(janela), [janela]);

  const dados = useMemo(() => {

    const parcelas = despesas.flatMap((d: any) =>
      (d.parcelas ?? []).map((p: any) => ({ ...p, despesa: d })),
    );

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

    const mensalizado = parcelas
      .filter((p: any) => monthKey(p.vencimento) === mesAtual && p.despesa.total_parcelas > 1)
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

    const serie = meses.map((key: string) => {
      const rec = receitas
        .filter((r: any) => monthKey(r.data_recebimento) === key)
        .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
      const des = parcelas
        .filter((p: any) => monthKey(p.vencimento) === key)
        .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);
      return { mes: monthLabel(key), Receitas: Number(rec.toFixed(2)), Despesas: Number(des.toFixed(2)) };
    });


    const parceladas = despesas
      .filter((d: any) => d.total_parcelas > 1)
      .map((d: any) => ({
        id: d.id,
        descricao: d.descricao,
        cartao: d.cartoes?.apelido ?? d.bancos?.nome ?? "Sem forma de pagamento",
        pagas: (d.parcelas ?? []).filter((p: any) => p.paga).length,
        total: d.total_parcelas,
      }))
      .filter((d: any) => d.pagas < d.total)
      .slice(0, 6);

    return {
      totalReceitas,
      totalDespesas,
      usdReceitas,
      usdDespesas,
      saldo: totalReceitas - totalDespesas,
      fixas,
      variaveis,
      mensalizado,
      dividaTotal,
      pie: Array.from(porCategoria, ([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
      meses: serie,
      parceladas,
    };
  }, [receitas, despesas, cotacao, mesAtual, mesPie, meses]);


  return (
    <AppLayout
      title="Dashboard"
      description={`Resumo de ${monthLabel(mesAtual)} · USD ${cotacao.toFixed(2)}`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
                  >
                    {dados.pie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Fluxo de caixa mês a mês</CardTitle>
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
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.meses} margin={{ top: 18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={dados.meses.length > 8 ? -35 : 0} textAnchor={dados.meses.length > 8 ? "end" : "middle"} height={dados.meses.length > 8 ? 46 : 24} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Receitas" fill="var(--success)" radius={[6, 6, 0, 0]}>
                  {dados.meses.length <= 12 && (
                    <LabelList dataKey="Receitas" position="top" fontSize={9} formatter={compact} />
                  )}
                </Bar>
                <Bar dataKey="Despesas" fill="var(--destructive)" radius={[6, 6, 0, 0]}>
                  {dados.meses.length <= 12 && (
                    <LabelList dataKey="Despesas" position="top" fontSize={9} formatter={compact} />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do saldo</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dados.meses.map((m: any) => ({ mes: m.mes, Saldo: Number((m.Receitas - m.Despesas).toFixed(2)) }))}
                margin={{ top: 18 }}
              >
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
}: {
  label: string;
  value: number;
  usd?: number;
  cotacao?: number;
  icon: typeof Wallet;
  tone: "success" | "destructive" | "warning";
  hint?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-destructive";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className={`size-4 ${toneClass}`} />
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight">{formatBRL(value)}</p>
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
