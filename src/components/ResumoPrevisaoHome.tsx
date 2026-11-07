import { useQuery } from "@tanstack/react-query";
import { usePreferencias } from "@/hooks/usePreferencias";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info, PiggyBank } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
        {
          despesas: despesas as any[],
          receitas: receitas as any[],
          faturas: faturasMes as any[],
          cotacao,
          cartoes: cartoes as any[],
          mostrarFaturaAberta: prefs.mostrar_fatura_aberta,
        },
        mes,
        metaDoMes(caixinhas, mes),
        prefs.dia_virada,
        prefs.receitas_proximo_ciclo_dia,
      ),
    [despesas, receitas, faturasMes, cotacao, cartoes, mes, caixinhas, prefs.dia_virada, prefs.receitas_proximo_ciclo_dia, prefs.mostrar_fatura_aberta],
  );
  // 03/11/2026: mostra de qual mês/ciclo é a previsão (ex.: outubro = 08/10 a 07/11 com virada no dia 8).
  const diasCiclo = datasDoCiclo(mes, prefs.dia_virada);
  const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const cicloTexto = diasCiclo.length ? `${fmtDia(diasCiclo[0]!)} a ${fmtDia(diasCiclo[diasCiclo.length - 1]!)}` : "";
  const serie = p.serie.map((s) => ({
    dia: s.dia,
    rotulo: s.rotulo,
    data: diasCiclo[s.dia - 1] ? fmtDia(diasCiclo[s.dia - 1]!) : String(s.rotulo),
    real: s.projetado ? null : s.saldo,
    previsto: s.dia >= p.diaHoje ? s.saldo : null,
  }));
  // 05/11/2026: apresentação apenas. Progresso do ciclo e composição das receitas, sem mudar a conta.
  const totalDias = serie.length || p.diasNoMes;
  const diasPassados = Math.min(totalDias, Math.max(0, totalDias - p.diasRestantes));
  const pctCiclo = totalDias > 0 ? Math.round((diasPassados / totalDias) * 100) : 0;
  const rotuloDia = (d: number) => serie[d - 1]?.data ?? String(d);
  const ticksX = Array.from(new Set([1, p.diaHoje > 1 && p.diaHoje < totalDias ? p.diaHoje : 1, totalDias])).filter((d) => d >= 1);

  if (!financasProntas) return <CartaoCarregando alturaGrafico="h-44" />;
  const encerrado = p.diaHoje >= p.diasNoMes && p.diasRestantes === 0;
  const temMeta = p.meta > 0;
  const semLivre = p.saldoLivre <= 0;
  const futuro = p.diaHoje === 0;
  const prefixo = futuro ? "No ritmo deste mês" : "Se continuar assim";

  return (
    <Card className={`${className ?? "mb-4 overflow-hidden"} transition-shadow duration-300 hover:shadow-md`}>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-balance text-lg font-semibold tracking-tight">Previsão do mês</h2>
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
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Saldo final do ciclo{temMeta ? ` (meta de guardar ${formatar(p.meta)})` : ""}
            </p>
            <p className={`text-5xl sm:text-6xl font-extrabold leading-none tabular-nums tracking-tight ${p.finalPrevisto >= p.meta ? "text-success" : "text-destructive"}`}>
              {formatar(p.finalPrevisto)}
            </p>
          </div>
        ) : semLivre ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Saldo livre do ciclo</p>
            <p className="text-5xl sm:text-6xl font-extrabold leading-none tabular-nums tracking-tight text-destructive">{formatar(p.saldoLivre)}</p>
            <p className="text-sm text-muted-foreground">
              Faltam <b className="font-semibold text-foreground">{formatar(Math.abs(p.saldoLivre))}</b>{" "}
              {temMeta ? "para cobrir as despesas do ciclo e a meta das caixinhas." : "para cobrir as despesas já comprometidas no ciclo."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Você pode gastar</p>
            <p className="text-5xl sm:text-6xl font-extrabold leading-none tabular-nums tracking-tight text-success">
              {formatar(p.porDia)} <span className="text-lg font-semibold tracking-normal text-muted-foreground">por dia</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {temMeta ? `para atingir sua meta de guardar ${formatar(p.meta)}` : "para não ficar negativo"}, com {p.diasRestantes}{" "}
              {p.diasRestantes === 1 ? "dia restante" : "dias restantes"}.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">Progresso do ciclo</span>
              <span className="tabular-nums text-muted-foreground">
                <b className="font-semibold text-foreground">{diasPassados}</b> de {totalDias} dias
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Dias passados no ciclo"
              aria-valuemin={0}
              aria-valuemax={totalDias}
              aria-valuenow={diasPassados}
            >
              <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-500" style={{ width: `${pctCiclo}%` }} />
            </div>
          </div>
          <BarraComposicao receitas={p.receitas} comprometido={p.comprometido} caixinhas={temMeta ? p.meta : 0} formatar={formatar} />
        </div>

        {!encerrado && (
          <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${p.alerta ? "bg-destructive/10" : "bg-success/10"}`}>
            {p.alerta ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
            <span>
              <b className="font-semibold">
                {p.alerta
                  ? `${prefixo}, termina o mês com ${formatar(p.finalPrevisto)}${temMeta && p.finalPrevisto >= 0 ? `, abaixo da meta de ${formatar(p.meta)}` : ""}.`
                  : `${prefixo}, sobram ${formatar(p.sobraPrevista)}${temMeta ? ` depois de guardar ${formatar(p.meta)}` : " no fim do mês"}.`}
              </b>{" "}
              <span className="text-muted-foreground">
                {p.ritmoDiario > 0 ? `Gastos variáveis: ${formatar(p.ritmoDiario)} por dia.` : "Sem gastos variáveis até agora."}
              </span>
            </span>
          </p>
        )}

        {p.estimativas.length > 0 && (
          <details className="group rounded-xl bg-warning/10 px-3 py-2 text-sm">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden">
              <Info className="size-4 shrink-0 text-warning-foreground" aria-hidden />
              <span className="font-semibold">Inclui {formatar(p.estimadoTotal)} estimados de faturas abertas</span>
              <span className="text-muted-foreground group-open:hidden">Ver detalhes</span>
            </summary>
            <ul className="mt-2 space-y-1">
              {p.estimativas.map((e) => (
                <li key={e.cartaoId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {e.nome} <span className="text-xs text-muted-foreground">média {formatar(e.media)}, lançado {formatar(e.real)}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">+{formatar(e.extra)}</span>
                </li>
              ))}
            </ul>
            <FaturaMesDialog
              trigger={
                <Button size="sm" variant="outline" className="mt-2 h-8">
                  Informar total da fatura
                </Button>
              }
            />
          </details>
        )}

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <dl className="overflow-hidden rounded-2xl border border-border/70 text-sm">
          <Linha rotulo="Receitas do mês" valor={`+${formatar(p.receitas)}`} tom="text-success" />
          <Linha rotulo="Despesas já comprometidas" valor={formatar(-p.comprometido)} tom="text-destructive" />
          {temMeta && <Linha rotulo="A guardar nas caixinhas" valor={formatar(-p.meta)} tom="text-primary" />}
          <Linha rotulo="Saldo livre" valor={formatar(p.saldoLivre)} forte tom={semLivre ? "text-destructive" : "text-success"} />
        </dl>

        <div className="space-y-2">
          <div className="h-[200px] w-full" role="img" aria-label="Gráfico do saldo acumulado dia a dia no ciclo">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 18, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="previsao-area-real" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="previsao-area-prevista" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="dia"
                  type="number"
                  domain={[1, Math.max(1, totalDias)]}
                  ticks={ticksX}
                  tickFormatter={(d: number) => rotuloDia(d)}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="2 3" />
                {temMeta && <ReferenceLine y={p.meta} stroke="var(--success)" strokeDasharray="4 4" />}
                {!encerrado && p.diaHoje > 0 && (
                  <ReferenceLine
                    x={p.diaHoje}
                    stroke="var(--foreground)"
                    strokeOpacity={0.35}
                    label={{ value: "Hoje", position: "top", fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const ponto = payload[0]?.payload as (typeof serie)[number] | undefined;
                    if (!ponto) return null;
                    const valor = ponto.real ?? ponto.previsto;
                    if (valor == null) return null;
                    const previsto = ponto.real == null;
                    return (
                      <div className="rounded-xl border border-border/70 bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="text-muted-foreground">
                          {ponto.data}
                          {previsto ? " · previsto" : ""}
                        </p>
                        <p className={`mt-0.5 text-sm font-semibold tabular-nums ${valor < 0 ? "text-destructive" : "text-foreground"}`}>
                          {formatar(valor)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="real"
                  name="Realizado"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#previsao-area-real)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="previsto"
                  name="Previsto"
                  stroke="var(--primary)"
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="url(#previsao-area-prevista)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
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

/** Barra horizontal: quanto das receitas já está comprometido, quanto vai para as caixinhas e o que sobra livre. */
function BarraComposicao({
  receitas,
  comprometido,
  caixinhas,
  formatar,
}: {
  receitas: number;
  comprometido: number;
  caixinhas: number;
  formatar: (v: number) => string;
}) {
  const desp = Math.max(0, comprometido);
  const cx = Math.max(0, caixinhas);
  const rec = Math.max(0, receitas);
  const base = Math.max(rec, desp + cx, 1);
  const livre = Math.max(0, rec - desp - cx);
  const pct = (v: number) => `${(v / base) * 100}%`;
  const excede = desp + cx > rec;
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Receitas comparadas com despesas comprometidas e caixinhas">
        {desp > 0 && <div className="h-full bg-destructive transition-[width] duration-500" title={`Comprometido ${formatar(desp)}`} style={{ width: pct(desp) }} />}
        {cx > 0 && <div className="h-full bg-primary transition-[width] duration-500" title={`Caixinhas ${formatar(cx)}`} style={{ width: pct(cx) }} />}
        {livre > 0 && <div className="h-full bg-success transition-[width] duration-500" title={`Livre ${formatar(livre)}`} style={{ width: pct(livre) }} />}
      </div>
      <ul className="grid grid-cols-3 gap-2 text-xs">
        <Legenda cor="bg-success" rotulo="Receitas" valor={formatar(rec)} tom="text-success" />
        <Legenda cor="bg-destructive" rotulo="Comprometido" valor={formatar(desp)} tom="text-destructive" />
        <Legenda cor="bg-primary" rotulo="Caixinhas" valor={formatar(cx)} tom="text-primary" />
      </ul>
      {excede && <p className="text-xs text-destructive">Comprometido e caixinhas passam das receitas do ciclo.</p>}
    </div>
  );
}

function Legenda({ cor, rotulo, valor, tom }: { cor: string; rotulo: string; valor: string; tom: string }) {
  return (
    <li className="min-w-0">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className={`size-2 shrink-0 rounded-full ${cor}`} aria-hidden />
        <span className="truncate">{rotulo}</span>
      </span>
      <span className={`mt-0.5 block truncate text-sm font-semibold tabular-nums ${tom}`}>{valor}</span>
    </li>
  );
}
