import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, PiggyBank } from "lucide-react";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CartaoCarregando } from "@/components/CartaoCarregando";
import { Card, CardContent } from "@/components/ui/card";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { listarCaixinhas, metaDoMes } from "@/lib/poupar";
import { calcularPrevisaoMes } from "@/lib/previsao-mes";

/**
 * Card "Previsão do mês" do Início. 27/10/2026: mesma conta e mesmos textos do app
 * (lib/previsao-mes.ts = controlall/src/lib/painel.ts): receitas com recorrentes projetadas,
 * despesas comprometidas, valor a guardar nas caixinhas e ritmo dos gastos variáveis.
 */
export function ResumoPrevisaoHome({ mes: mesEscolhido, className }: { mes?: string; className?: string } = {}) {
  const financasProntas = useFinancasProntas();
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: receitas = [] } = useReceitas();
  const { data: caixinhas = [] } = useQuery({ queryKey: ["caixinhas"], queryFn: listarCaixinhas, retry: false });
  const { formatar } = usePrivacidadeValores("resumo-previsao-home");
  const mesVigente = useCompetenciaVigente();
  // Na tela Finanças segue o mês escolhido no filtro; no Início, a competência vigente.
  const mes = mesEscolhido ?? mesVigente;

  const p = useMemo(
    () =>
      calcularPrevisaoMes(
        { despesas: despesas as any[], receitas: receitas as any[], faturas: faturasMes as any[], cotacao },
        mes,
        metaDoMes(caixinhas, mes),
      ),
    [despesas, receitas, faturasMes, cotacao, mes, caixinhas],
  );
  const serie = p.serie.map((s) => ({
    dia: s.dia,
    real: s.projetado ? null : s.saldo,
    previsto: s.dia >= p.diaHoje ? s.saldo : null,
  }));

  if (!financasProntas) return <CartaoCarregando alturaGrafico="h-44" />;
  const encerrado = p.diaHoje >= p.diasNoMes && p.diasRestantes === 0;
  const temMeta = p.meta > 0;
  const semLivre = p.saldoLivre <= 0;
  const futuro = p.diaHoje === 0;
  const prefixo = futuro ? "No ritmo deste mês" : "Se continuar assim";

  return (
    <Card className={className ?? "mb-4 overflow-hidden border-primary/30"}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Previsão do mês</p>
        {encerrado ? (
          <div>
            <p className={`text-2xl font-bold ${p.finalPrevisto >= p.meta ? "text-emerald-600" : "text-rose-600"}`}>{formatar(p.finalPrevisto)}</p>
            <p className="text-xs text-muted-foreground">Mês encerrado: saldo final{temMeta ? ` (meta de guardar ${formatar(p.meta)})` : ""}.</p>
          </div>
        ) : semLivre ? (
          <div>
            <p className="text-2xl font-bold text-rose-600">Sem saldo livre</p>
            <p className="text-sm text-muted-foreground">
              Faltam <b className="text-rose-600">{formatar(Math.abs(p.saldoLivre))}</b>{" "}
              {temMeta ? "para cobrir as despesas do mês e a meta das caixinhas." : "para cobrir as despesas já comprometidas no mês."}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Você pode gastar</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatar(p.porDia)} <span className="text-base font-semibold">por dia</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {temMeta ? `para atingir sua meta de guardar ${formatar(p.meta)}` : "para não ficar negativo"} · {p.diasRestantes}{" "}
              {p.diasRestantes === 1 ? "dia restante" : "dias restantes"}
            </p>
          </div>
        )}

        {!encerrado && (
          <div className={`flex gap-2 rounded-lg p-3 ${p.alerta ? "bg-rose-500/10" : "bg-emerald-500/10"}`}>
            {p.alerta ? <AlertTriangle className="size-5 shrink-0 text-rose-600" /> : <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />}
            <div className="text-sm">
              {p.alerta ? (
                <p className="font-semibold text-rose-600">
                  {prefixo}, termina o mês com {formatar(p.finalPrevisto)}
                  {temMeta && p.finalPrevisto >= 0 ? `, abaixo da meta de ${formatar(p.meta)}` : ""}
                </p>
              ) : (
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {prefixo}, sobram {formatar(p.sobraPrevista)}
                  {temMeta ? ` depois de guardar ${formatar(p.meta)}` : " no fim do mês"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {p.ritmoDiario > 0 ? `Ritmo dos gastos variáveis: ${formatar(p.ritmoDiario)} por dia.` : "Sem gastos variáveis no mês até agora."}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
          <Linha rotulo="Receitas do mês" valor={formatar(p.receitas)} />
          <Linha rotulo="Despesas já comprometidas" valor={formatar(-p.comprometido)} />
          {temMeta && <Linha rotulo="A guardar nas caixinhas" valor={formatar(-p.meta)} />}
          <div className="my-1 h-px bg-border" />
          <Linha rotulo="Saldo livre" valor={formatar(p.saldoLivre)} forte />
        </div>

        <div className="h-40 w-full sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis hide />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
              {temMeta && <ReferenceLine y={p.meta} stroke="#10b981" strokeDasharray="4 4" />}
              <Tooltip formatter={(v: number) => formatar(v)} labelFormatter={(d) => `Dia ${d}`} />
              <Line type="monotone" dataKey="real" name="Realizado" stroke="var(--primary)" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="previsto" name="Previsto" stroke="var(--primary)" strokeWidth={2.5} strokeDasharray="6 6" dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Real até hoje, projetado pelo ritmo depois{temMeta ? ` · meta ${formatar(p.meta)}` : ""}</span>
          <Link to="/caixinhas" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <PiggyBank className="size-3.5" /> {temMeta ? "Ver caixinhas" : "Criar uma caixinha"}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={forte ? "font-semibold" : "text-muted-foreground"}>{rotulo}</span>
      <span className={forte ? "font-bold" : "font-medium"}>{valor}</span>
    </div>
  );
}
