import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { formatBRL, monthKey, monthLabel, toBRL } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

export type OpcaoGrafico = "fluxo" | "saldo" | "categorias";

export const OPCOES_GRAFICO: { value: OpcaoGrafico; label: string }[] = [
  { value: "fluxo", label: "Receitas x despesas (3 meses)" },
  { value: "saldo", label: "Saldo por mês (3 meses)" },
  { value: "categorias", label: "Despesas por categoria (mês atual)" },
];

export function opcaoGraficoValida(v: unknown): OpcaoGrafico {
  return OPCOES_GRAFICO.some((o) => o.value === v) ? (v as OpcaoGrafico) : "fluxo";
}

/** Widget de gráfico da Início: o usuário escolhe qual gráfico ver. */
export function GraficoHome({
  opcao,
  onOpcao,
}: {
  opcao: OpcaoGrafico;
  onOpcao: (o: OpcaoGrafico) => void;
}) {
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: receitas = [] } = useReceitas();
  const { ocultarValores } = usePrivacidadeValores();
  const vigente = useCompetenciaVigente();

  const meses = useMemo(() => {
    const now = new Date();
    return [-1, 0, 1].map((i) => monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }, []);

  const parcelas = useMemo(
    () =>
      aplicarRegrasFaturaMes(lancamentosPorCompetencias(despesas as any[], meses), faturasMes as any[]),
    [despesas, meses, faturasMes],
  );

  const serie = useMemo(
    () =>
      meses.map((key) => {
        const des = parcelas
          .filter((p) => monthKey(p.vencimento) === key)
          .reduce((s, p) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);
        const rec = (receitas as any[])
          .filter((r) => monthKey(r.data_recebimento) === key)
          .reduce((s, r) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
        return {
          mes: monthLabel(key),
          Receitas: Number(rec.toFixed(2)),
          Despesas: Number(des.toFixed(2)),
          Saldo: Number((rec - des).toFixed(2)),
        };
      }),
    [meses, parcelas, receitas, cotacao],
  );

  const categorias = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of parcelas) {
      if (monthKey(p.vencimento) !== vigente) continue;
      const cat = (p.despesa as any).categoria ?? "outros";
      mapa.set(cat, (mapa.get(cat) ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao));
    }
    return [...mapa]
      .map(([nome, valor]) => ({ nome, valor: Number(valor.toFixed(2)) }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [parcelas, vigente, cotacao]);

  const fmt = (v: unknown) => (ocultarValores ? "R$ ••••••" : formatBRL(Number(v)));
  const vazio =
    opcao === "categorias" ? categorias.length === 0 : serie.every((s) => !s.Receitas && !s.Despesas);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="size-4" aria-hidden="true" /> Gráfico
        </CardTitle>
        <Select value={opcao} onValueChange={(v) => onOpcao(opcaoGraficoValida(v))}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-[250px]" aria-label="Escolher gráfico">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCOES_GRAFICO.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-[260px]">
        {vazio ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">Ainda não há lançamentos para este gráfico.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {opcao === "categorias" ? (
              <BarChart data={categorias} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={90} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar maxBarSize={44} isAnimationActive={false} dataKey="valor" name="Despesas" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : opcao === "saldo" ? (
              <BarChart data={serie} margin={{ top: 24, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar maxBarSize={44} isAnimationActive={false} dataKey="Saldo" radius={[4, 4, 0, 0]}>
                  {serie.map((s, i) => (
                    <Cell key={i} fill={s.Saldo >= 0 ? "var(--success)" : "var(--destructive)"} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={serie} margin={{ top: 24, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar maxBarSize={44} isAnimationActive={false} dataKey="Receitas" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar maxBarSize={44} isAnimationActive={false} dataKey="Despesas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
