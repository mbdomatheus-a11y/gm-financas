import { useQuery } from "@tanstack/react-query";
import { usePreferencias } from "@/hooks/usePreferencias";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info, PiggyBank } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CartaoCarregando } from "@/components/CartaoCarregando";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FaturaMesDialog } from "@/components/FaturaMesDialog";
import { useCotacao } from "@/hooks/useCotacao";
import { useCartoes, useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { listarCaixinhas, metaDoMes } from "@/lib/poupar";
import { calcularPrevisaoMes, datasDoCiclo } from "@/lib/previsao-mes";
import { monthLabelLong } from "@/lib/format";
import { somarMeses } from "@/lib/recorrencia";

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
  const { data: cartoes = [] } = useCartoes();
  const { data: receitas = [] } = useReceitas();
  const { data: caixinhas = [] } = useQuery({ queryKey: ["caixinhas"], queryFn: listarCaixinhas, retry: false });
  const { formatar } = usePrivacidadeValores("resumo-previsao-home");
  const mesVigente = useCompetenciaVigente();
  const { prefs } = usePreferencias();
  // Na tela Finanças segue o mês escolhido no filtro; no Início, a competência vigente.
  // 03/11/2026: no Início dá para ver o ciclo atual ou planejar o próximo (na tela Finanças vale o mês escolhido).
  const [proximo, setProximo] = useState(false);
  const podeTrocar = mesEscolhido === undefined;
  const mes = mesEscolhido ?? (proximo ? somarMeses(mesVigente, 1) : mesVigente);

  const p = useMemo(
    () =>
      calcularPrevisaoMes(
        { despesas: despesas as any[], receitas: receitas as any[], faturas: faturasMes as any[], cotacao, cartoes: cartoes as any[] },
        mes,
        metaDoMes(caixinhas, mes),
        prefs.dia_virada,
        prefs.receitas_proximo_ciclo_dia,
      ),
    [despesas, receitas, faturasMes, cotacao, cartoes, mes, caixinhas, prefs.dia_virada, prefs.receitas_proximo_ciclo_dia],
  );
  // 03/11/2026: mostra de qual mês/ciclo é a previsão (ex.: outubro = 08/10 a 07/11 com virada no dia 8).
  const diasCiclo = datasDoCiclo(mes, prefs.dia_virada);
  const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const cicloTexto = diasCiclo.length ? `${fmtDia(diasCiclo[0]!)} a ${fmtDia(diasCiclo[diasCiclo.length - 1]!)}` : "";
  const serie = p.serie.map((s) => ({
    dia: s.dia,
    rotulo: s.rotulo,
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
    <Card className={className ?? "mb-4 overflow-hidden"}>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-balance text-lg font-bold tracking-tight">Previsão do mês</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {monthLabelLong(mes)}
              {cicloTexto && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-foreground">
                  ciclo {cicloTexto}
                </span>
              )}
            </p>
          </div>
          {podeTrocar && (
            <div role="group" aria-label="Ciclo da previsão" className="inline-flex rounded-full bg-muted p-1 text-sm">
              {([false, true] as const).map((alvo) => (
                <button
                  key={String(alvo)}
                  type="button"
                  aria-pressed={proximo === alvo}
                  onClick={() => setProximo(alvo)}
                  className={`min-h-9 rounded-full px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    proximo === alvo ? "bg-card text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {alvo ? "Próximo ciclo" : "Ciclo atual"}
                </button>
              ))}
            </div>
          )}
        </header>

        {encerrado ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Saldo final do ciclo{temMeta ? ` (meta de guardar ${formatar(p.meta)})` : ""}
            </p>
            <p className={`text-4xl font-extrabold tabular-nums tracking-tight ${p.finalPrevisto >= p.meta ? "text-success" : "text-destructive"}`}>
              {formatar(p.finalPrevisto)}
            </p>
          </div>
        ) : semLivre ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Saldo livre do ciclo</p>
            <p className="text-4xl font-extrabold tabular-nums tracking-tight text-destructive">{formatar(p.saldoLivre)}</p>
            <p className="text-sm text-muted-foreground">
              Faltam <b className="font-semibold text-foreground">{formatar(Math.abs(p.saldoLivre))}</b>{" "}
              {temMeta ? "para cobrir as despesas do ciclo e a meta das caixinhas." : "para cobrir as despesas já comprometidas no ciclo."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Você pode gastar</p>
            <p className="text-4xl font-extrabold tabular-nums tracking-tight text-success">
              {formatar(p.porDia)} <span className="text-base font-semibold text-muted-foreground">por dia</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {temMeta ? `para atingir sua meta de guardar ${formatar(p.meta)}` : "para não ficar negativo"}, com {p.diasRestantes}{" "}
              {p.diasRestantes === 1 ? "dia restante" : "dias restantes"}.
            </p>
          </div>
        )}

        {!encerrado && (
          <div className={`flex items-start gap-3 rounded-2xl p-4 ${p.alerta ? "bg-destructive/10" : "bg-success/10"}`}>
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full ${p.alerta ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}
            >
              {p.alerta ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            </span>
            <div className="min-w-0 text-sm">
              {p.alerta ? (
                <p className="font-semibold text-foreground">
                  {prefixo}, termina o mês com {formatar(p.finalPrevisto)}
                  {temMeta && p.finalPrevisto >= 0 ? `, abaixo da meta de ${formatar(p.meta)}` : ""}
                </p>
              ) : (
                <p className="font-semibold text-foreground">
                  {prefixo}, sobram {formatar(p.sobraPrevista)}
                  {temMeta ? ` depois de guardar ${formatar(p.meta)}` : " no fim do mês"}
                </p>
              )}
              <p className="mt-0.5 text-muted-foreground">
                {p.ritmoDiario > 0 ? `Ritmo dos gastos variáveis: ${formatar(p.ritmoDiario)} por dia.` : "Sem gastos variáveis no mês até agora."}
              </p>
            </div>
          </div>
        )}

        {p.estimativas.length > 0 && (
          <section className="rounded-2xl border border-warning/50 bg-warning/10 p-4 text-sm">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning/25 text-warning-foreground">
                <Info className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="font-semibold">Inclui {formatar(p.estimadoTotal)} estimados para faturas ainda abertas</p>
                  <p className="text-muted-foreground">Informe o total da fatura para trocar a estimativa pelo valor certo.</p>
                </div>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card/70">
                  {p.estimativas.map((e) => (
                    <li key={e.cartaoId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Média {formatar(e.media)}, lançado {formatar(e.real)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">+{formatar(e.extra)}</span>
                    </li>
                  ))}
                </ul>
                <FaturaMesDialog
                  trigger={
                    <Button size="sm" variant="outline" className="h-9">
                      Informar total da fatura
                    </Button>
                  }
                />
              </div>
            </div>
          </section>
        )}

        <dl className="overflow-hidden rounded-2xl border border-border/70 text-sm">
          <Linha rotulo="Receitas do mês" valor={`+${formatar(p.receitas)}`} tom="text-success" />
          <Linha rotulo="Despesas já comprometidas" valor={formatar(-p.comprometido)} />
          {temMeta && <Linha rotulo="A guardar nas caixinhas" valor={formatar(-p.meta)} />}
          <Linha rotulo="Saldo livre" valor={formatar(p.saldoLivre)} forte tom={semLivre ? "text-destructive" : "text-success"} />
        </dl>

        <div className="space-y-2">
          <div className="h-44 w-full sm:h-52" role="img" aria-label="Gráfico do saldo acumulado dia a dia no ciclo">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                <YAxis hide />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
                {temMeta && <ReferenceLine y={p.meta} stroke="var(--success)" strokeDasharray="4 4" />}
                <Tooltip formatter={(v: number) => formatar(v)} labelFormatter={(d) => `Dia ${d}`} />
                <Line type="monotone" dataKey="real" name="Realizado" stroke="var(--primary)" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="previsto" name="Previsto" stroke="var(--primary)" strokeWidth={2.5} strokeDasharray="6 6" dot={false} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-primary" aria-hidden /> Realizado
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-primary" aria-hidden /> Previsto
              </li>
              {temMeta && (
                <li className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-success" aria-hidden /> Meta {formatar(p.meta)}
                </li>
              )}
            </ul>
            <Link
              to="/caixinhas"
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <PiggyBank className="size-3.5" /> {temMeta ? "Ver caixinhas" : "Criar uma caixinha"}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Linha({ rotulo, valor, forte, tom }: { rotulo: string; valor: string; forte?: boolean; tom?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${forte ? "bg-muted/50" : "border-b border-border/60"}`}>
      <dt className={forte ? "font-semibold" : "text-muted-foreground"}>{rotulo}</dt>
      <dd className={`tabular-nums ${forte ? "font-bold" : "font-medium"} ${tom ?? ""}`}>{valor}</dd>
    </div>
  );
}
