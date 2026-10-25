import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { CartaoCarregando } from "@/components/CartaoCarregando";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { monthKey, toBRL } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

/**
 * Card do Início: quanto deve sobrar até o fim da competência vigente.
 * Usa só lançamentos já cadastrados (receitas recebidas/previstas e despesas
 * e parcelas com vencimento no mês). Linha sólida até hoje; tracejada é projeção.
 */
export function ResumoPrevisaoHome() {
  const financasProntas = useFinancasProntas();
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: receitas = [] } = useReceitas();
  const { formatar } = usePrivacidadeValores("resumo-previsao-home");
  const competencia = useCompetenciaVigente();

  const resumo = useMemo(() => {
    const [ano = 1970, mes = 1] = competencia.split("-").map(Number);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const hoje = new Date();
    const hojeKey = monthKey(hoje);
    const diaHoje =
      competencia === hojeKey ? hoje.getDate() : competencia < hojeKey ? diasNoMes : 0;

    const parcelas = aplicarRegrasFaturaMes(
      lancamentosPorCompetencias(despesas as any[], [competencia]),
      faturasMes as any[],
    ).filter((p) => monthKey(p.vencimento) === competencia);

    const entradasPorDia = new Array(diasNoMes + 1).fill(0);
    const saidasPorDia = new Array(diasNoMes + 1).fill(0);
    for (const r of receitas as any[]) {
      if (monthKey(r.data_recebimento) !== competencia) continue;
      const dia = Math.min(diasNoMes, new Date(r.data_recebimento).getDate());
      entradasPorDia[dia] += toBRL(Number(r.valor), r.moeda, cotacao);
    }
    for (const p of parcelas) {
      const dia = Math.min(diasNoMes, new Date(p.vencimento).getDate());
      saidasPorDia[dia] += toBRL(Number(p.valor), p.despesa.moeda, cotacao);
    }

    let entradas = 0;
    let saidas = 0;
    const serie = [];
    for (let d = 1; d <= diasNoMes; d++) {
      entradas += entradasPorDia[d];
      saidas += saidasPorDia[d];
      const saldo = Number((entradas - saidas).toFixed(2));
      serie.push({
        dia: d,
        real: d <= diaHoje ? saldo : null,
        previsto: d >= diaHoje ? saldo : null,
      });
    }
    return {
      diasNoMes,
      sobra: Number((entradas - saidas).toFixed(2)),
      serie,
    };
  }, [competencia, despesas, faturasMes, receitas, cotacao]);

  const positivo = resumo.sobra >= 0;
  const Icone = positivo ? TrendingUp : TrendingDown;

  if (!financasProntas) return <CartaoCarregando alturaGrafico="h-44" />;
  return (
    <Card className="mb-4 overflow-hidden border-primary/30">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Previsão do mês</p>
            <p className="text-xl font-bold sm:text-2xl">
              {positivo ? "Sobram" : "Faltam"}{" "}
              <span className={positivo ? "text-emerald-600" : "text-rose-600"}>
                {formatar(Math.abs(resumo.sobra))}
              </span>{" "}
              <span className="text-base font-medium text-muted-foreground">
                até o dia {resumo.diasNoMes}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Considera receitas e despesas já cadastradas para este mês.
            </p>
          </div>
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
              positivo ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
            }`}
          >
            <Icone className="size-5" aria-hidden="true" />
          </span>
        </div>
        <div className="h-40 w-full sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={resumo.serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis hide />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
              <Tooltip
                formatter={(v: number) => formatar(v)}
                labelFormatter={(d) => `Dia ${d}`}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Realizado"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="previsto"
                name="Previsto"
                stroke="var(--primary)"
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
