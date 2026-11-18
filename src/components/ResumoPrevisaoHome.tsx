import { Link } from "@tanstack/react-router";
import { PiggyBank } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CartaoCarregando } from "@/components/CartaoCarregando";
import { Card, CardContent } from "@/components/ui/card";
import { CenarioRitmo, SobraCiclo } from "@/components/SobraCiclo";
import { useDadosCiclo } from "@/hooks/useNumerosCiclo";
import { previsaoPeloRitmo } from "@/lib/numeros-ciclo";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { metaDoMes } from "@/lib/poupar";
import { calcularPrevisaoMes } from "@/lib/previsao-mes";
import { abreviarValor } from "@/lib/format";
import { rotuloDoCiclo } from "@/lib/rotulo-ciclo";
import { somarMeses } from "@/lib/recorrencia";

/**
 * Card "Previsão do mês" do Início e da tela Finanças.
 * 18/11/2026 (revisão do Matheus): enxuto e com o saldo do ciclo no gráfico.
 *  - Destaque: "Vai sobrar em DD/MM" com o que JÁ ESTÁ LANÇADO (numeros-ciclo.ts, sem estimativa).
 *  - Gráfico do saldo dia a dia: real até hoje, "com o lançado" (termina no número grande) e
 *    "pelo ritmo" (gasto no cartão por dia do ciclo anterior; termina no cenário).
 *  - Cenário pelo ritmo numa caixa pequena, com o racional na seta. Mesma conta no app (previsao.tsx).
 */
export function ResumoPrevisaoHome({ mes: mesEscolhido, className }: { mes?: string; className?: string } = {}) {
  const financasProntas = useFinancasProntas();
  const { formatar, ocultoNesteItem } = usePrivacidadeValores("resumo-previsao-home");
  const mesVigente = useCompetenciaVigente();
  const [proximo, setProximo] = useState(false);
  const podeTrocar = mesEscolhido === undefined;
  const mes = mesEscolhido ?? (proximo ? somarMeses(mesVigente, 1) : mesVigente);

  const { dados, caixinhas: caixinhasCiclo, diaVirada } = useDadosCiclo();
  const p = useMemo(
    () => calcularPrevisaoMes(dados, mes, metaDoMes(caixinhasCiclo, mes), diaVirada),
    [dados, mes, caixinhasCiclo, diaVirada],
  );
  const n = p.numeros;
  const ritmo = useMemo(() => previsaoPeloRitmo(dados, mes, n, diaVirada), [dados, mes, n, diaVirada]);
  const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  // Saldo do ciclo por dia. Caixinhas saem do que ainda está por vir (o fim fecha com o número grande).
  const serie = useMemo(() => {
    const meta = n.previsto.caixinhas;
    const hoje = n.futuro ? 0 : n.diaHoje;
    const restantes = Math.max(1, n.diasNoCiclo - hoje);
    const comRitmo = ritmo.base !== "sem dados" && ritmo.aMais >= 0.5;
    return n.serie.map((s) => {
      const lancado = s.projetado ? s.saldo - meta : s.saldo;
      const depois = Math.max(0, s.dia - hoje);
      return {
        dia: s.dia,
        data: fmtDia(s.iso),
        real: s.projetado ? null : s.saldo,
        lancado: s.dia >= hoje ? Math.round(lancado * 100) / 100 : null,
        ritmo: comRitmo && s.dia >= hoje ? Math.round((lancado - (ritmo.aMais * depois) / restantes) * 100) / 100 : null,
      };
    });
  }, [n, ritmo]);

  if (!financasProntas) return <CartaoCarregando alturaGrafico="h-44" />;
  const totalDias = serie.length || 1;
  const encerrado = n.encerrado;
  const passoX = Math.max(2, Math.ceil(totalDias / 6));
  const ticksX = Array.from(
    new Set(
      [
        ...Array.from({ length: totalDias }, (_, i) => i + 1).filter(
          (d) => (d - 1) % passoX === 0 && Math.abs(d - n.diaHoje) >= passoX / 2 && totalDias - d >= passoX / 2,
        ),
        totalDias,
        ...(n.diaHoje > 0 && n.diaHoje <= totalDias ? [n.diaHoje] : []),
      ].filter((d) => d >= 1),
    ),
  ).sort((x, y) => x - y);
  const temRitmo = serie.some((x) => x.ritmo != null);
  const temMeta = n.previsto.caixinhas > 0;

  return (
    <Card className={`${className ?? "mb-4 overflow-hidden"} transition-shadow duration-300 hover:shadow-md`}>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-balance text-lg font-semibold tracking-tight">Previsão do mês</h2>
            <p className="text-xs text-muted-foreground">
              {rotuloDoCiclo(mes)} · {n.textoCiclo}
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

        <SobraCiclo numeros={n} formatar={formatar} mostrarCiclo={false} />

        <div className="space-y-3 rounded-2xl border border-border/70 p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Saldo do ciclo, dia a dia</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              dia {Math.min(totalDias, Math.max(0, n.diaHoje))} de {totalDias}
            </p>
          </div>
          {!encerrado && <CenarioRitmo ritmo={ritmo} fim={n.fim} formatar={formatar} />}
          <div className="h-[240px] w-full" role="img" aria-label="Saldo do ciclo dia a dia: real até hoje, com o lançado e pelo ritmo de gastos">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="dia"
                  type="number"
                  domain={[1, Math.max(1, totalDias)]}
                  ticks={ticksX}
                  tickFormatter={(d: number) => (d === n.diaHoje && !encerrado ? "Hoje" : (serie[d - 1]?.data ?? String(d)))}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  width={48}
                  tickCount={5}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => (ocultoNesteItem ? "••••" : v === 0 ? "0" : abreviarValor(v))}
                />
                <ReferenceLine y={0} stroke="var(--destructive)" strokeOpacity={0.35} />
                {!encerrado && n.diaHoje > 0 && (
                  <ReferenceLine
                    x={n.diaHoje}
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
                    return (
                      <div className="space-y-0.5 rounded-xl border border-border/70 bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-medium text-muted-foreground">{ponto.data}</p>
                        {ponto.real != null && <p className="text-sm font-semibold tabular-nums">Real {formatar(ponto.real)}</p>}
                        {ponto.lancado != null && ponto.real == null && (
                          <p className="text-sm font-semibold tabular-nums">Com o lançado {formatar(ponto.lancado)}</p>
                        )}
                        {ponto.ritmo != null && ponto.real == null && (
                          <p className="tabular-nums text-muted-foreground">Pelo ritmo {formatar(ponto.ritmo)}</p>
                        )}
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="real" name="Real" stroke="var(--primary)" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line
                  type="stepAfter"
                  dataKey="lancado"
                  name="Com o lançado"
                  stroke="var(--success)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {temRitmo && (
                  <Line
                    type="monotone"
                    dataKey="ritmo"
                    name="Pelo ritmo"
                    stroke="var(--warning)"
                    strokeWidth={2}
                    strokeDasharray="2 4"
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {/* 18/11/2026: legenda mais nítida (texto maior, cor forte e traços mais grossos). */}
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm font-medium text-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1 w-5 rounded bg-primary" aria-hidden /> Real
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 border-t-[3px] border-dashed border-success" aria-hidden /> Com o lançado
              </li>
              {temRitmo && (
                <li className="flex items-center gap-2">
                  <span className="w-5 border-t-[3px] border-dotted border-warning" aria-hidden /> Pelo ritmo
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
