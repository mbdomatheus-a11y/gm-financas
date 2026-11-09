import { usePreferencias } from "@/hooks/usePreferencias";
import { Link } from "@tanstack/react-router";
import { Info, PiggyBank } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CartaoCarregando } from "@/components/CartaoCarregando";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SobraCiclo } from "@/components/SobraCiclo";
import { FaturaMesDialog } from "@/components/FaturaMesDialog";
import { useDadosCiclo } from "@/hooks/useNumerosCiclo";
import { ritmoDoCiclo, rotuloPrevisto, textoRitmo } from "@/lib/numeros-ciclo";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { metaDoMes } from "@/lib/poupar";
import { calcularPrevisaoMes, datasDoCiclo } from "@/lib/previsao-mes";
import { monthLabelLong } from "@/lib/format";
import { somarMeses } from "@/lib/recorrencia";

/**
 * Card "Previsão do mês" do Início. 27/10/2026: mesma conta e mesmos textos do app
 * (lib/previsao-mes.ts = controlall/src/lib/painel.ts): receitas com recorrentes projetadas,
 * despesas comprometidas e valor a guardar nas caixinhas. 07/11/2026: a sobra vem só de numeros-ciclo.ts
 * ("Sobra até agora" em destaque e "Previsto no fim do ciclo" abaixo); o forecast por ritmo foi removido.
 */
export function ResumoPrevisaoHome({ mes: mesEscolhido, className }: { mes?: string; className?: string } = {}) {
  const financasProntas = useFinancasProntas();
  const { formatar } = usePrivacidadeValores("resumo-previsao-home");
  const mesVigente = useCompetenciaVigente();
  const { prefs } = usePreferencias();
  // Na tela Finanças segue o mês escolhido no filtro; no Início, a competência vigente.
  // 03/11/2026: no Início dá para ver o ciclo atual ou planejar o próximo (na tela Finanças vale o mês escolhido).
  const [proximo, setProximo] = useState(false);
  const podeTrocar = mesEscolhido === undefined;
  const mes = mesEscolhido ?? (proximo ? somarMeses(mesVigente, 1) : mesVigente);

  const { dados, caixinhas: caixinhasCiclo, diaVirada } = useDadosCiclo();
  const p = useMemo(
    () => calcularPrevisaoMes(dados, mes, metaDoMes(caixinhasCiclo, mes), diaVirada),
    [dados, mes, caixinhasCiclo, diaVirada],
  );
  // 03/11/2026: mostra de qual mês/ciclo é a previsão (ex.: outubro = 08/10 a 07/11 com virada no dia 8).
  // 08/11/2026: regra do ciclo: "15/nov a 15/dez · faltam N dias" (receitas desde D, contas até D).
  const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const cicloTexto = p.numeros.textoCiclo;
  const ritmo = useMemo(
    () => ritmoDoCiclo(dados, mes, p.numeros, diaVirada),
    [dados, mes, p.numeros, diaVirada],
  );
  const frase = textoRitmo(ritmo, p.numeros.fim, formatar);
  const mostrarRitmo = (!ritmo.cedo && !p.numeros.encerrado && !p.numeros.futuro && ritmo.adicional > 0);
  const serie = p.serie.map((s) => ({
    dia: s.dia,
    rotulo: s.rotulo,
    data: s.iso ? fmtDia(s.iso) : String(s.rotulo),
    real: s.projetado ? null : s.saldo,
    previsto: s.dia >= p.diaHoje ? s.saldo : null,
    ritmo:
      mostrarRitmo && s.dia >= p.diaHoje && p.diasNoMes > p.diaHoje
        ? Math.round((s.saldo - (ritmo.adicional * (s.dia - p.diaHoje)) / (p.diasNoMes - p.diaHoje)) * 100) / 100
        : null,
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
  const semLivre = p.numeros.previsto.sobra < 0;

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
              {cicloTexto && <span className="basis-full text-xs">{p.numeros.janelas.descricao}</span>}
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

        <SobraCiclo numeros={p.numeros} formatar={formatar} mostrarCiclo={false} />

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
          <Linha rotulo="Receitas previstas no ciclo" valor={`+${formatar(p.receitas)}`} tom="text-success" />
          <Linha rotulo="Despesas previstas no ciclo" valor={formatar(-p.comprometido)} tom="text-destructive" />
          {temMeta && <Linha rotulo="A guardar nas caixinhas" valor={formatar(-p.meta)} tom="text-primary" />}
          <Linha rotulo={rotuloPrevisto(p.numeros)} valor={formatar(p.numeros.previsto.sobra)} forte tom={semLivre ? "text-destructive" : "text-success"} />
        </dl>

        <div className="space-y-2">
          <div className="h-[200px] w-full" role="img" aria-label="Gráfico do saldo acumulado dia a dia no ciclo">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 18, right: 12, left: 12, bottom: 0 }}>
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
                {mostrarRitmo && (
                  <Line
                    type="monotone"
                    dataKey="ritmo"
                    name="No ritmo atual"
                    stroke="var(--destructive)"
                    strokeOpacity={0.8}
                    strokeWidth={2}
                    strokeDasharray="2 4"
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
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
              </ComposedChart>
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
              {mostrarRitmo && (
                <li className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dotted border-destructive" aria-hidden /> No ritmo atual
                </li>
              )}
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
          <p className="text-xs leading-relaxed text-muted-foreground">
            {frase.linha1}
            {frase.linha2 && (
              <>
                {" "}
                <span className={frase.tom === "negativo" ? "text-destructive/90" : "text-success"}>{frase.linha2}</span>
              </>
            )}
          </p>
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
