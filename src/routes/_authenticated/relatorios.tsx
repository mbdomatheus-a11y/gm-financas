import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChartPie,
  CreditCard,
  Layers,
  LineChart as IconeLinha,
  Receipt,
  Telescope,
  Wallet,
} from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { CartaoCarregando } from "@/components/CartaoCarregando";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategoriasPreferencias } from "@/hooks/useCategoriasPreferencias";
import { useCotacao } from "@/hooks/useCotacao";
import { useEstruturaCategorias } from "@/hooks/useEstruturaCategorias";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { useTransferencias } from "@/hooks/useContas";
import { useCartoes, useDespesas, useFaturasMes, useInvestimentos, useReceitas } from "@/hooks/useFinance";
import { usePreferencias } from "@/hooks/usePreferencias";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { abreviarValor, competenciaDoDia, monthLabel, monthLabelLong } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { somarMeses } from "@/lib/recorrencia";
import {
  agrupar,
  competenciasDasParceladas,
  despesasPorCompetencia,
  intervaloCompetencias,
  naturezaDaDespesa,
  receitasDaCompetencia,
  resumirParcelamentos,
  saldoDiario,
  seriePorMes,
  somar,
  ultimasCompetencias,
  type Fatia,
  type Parcelamento,
} from "@/lib/relatorios";
import { movimentosDeInvestimentos, totaisInvestimentos } from "@/lib/regras-saldo";
import { useDadosCiclo } from "@/hooks/useNumerosCiclo";
import { SobraCiclo } from "@/components/SobraCiclo";
import { calcularNumerosCiclo, calcularNumerosDosCiclos, type NumerosCiclo } from "@/lib/numeros-ciclo";
import { metaDoMes } from "@/lib/poupar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | Control ALL" },
      { name: "description", content: "Resumo, categorias, saldo, previsão e parcelas em um só lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RelatoriosPage,
});

type Periodo = "atual" | "passado" | "3m" | "custom";
type Aba = "resumo" | "categorias" | "saldo" | "previsao" | "parcelas";

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "atual", label: "Mês atual" },
  { value: "passado", label: "Mês passado" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "custom", label: "Personalizado" },
];

const ABAS: { value: Aba; label: string }[] = [
  { value: "resumo", label: "Resumo" },
  { value: "categorias", label: "Categorias" },
  { value: "saldo", label: "Saldo" },
  { value: "previsao", label: "Previsão" },
  { value: "parcelas", label: "Parcelas" },
];

const eixo = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function RelatoriosPage() {
  const prontas = useFinancasProntas();
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: receitas = [] } = useReceitas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: cartoes = [] } = useCartoes();
  const { macroDe } = useEstruturaCategorias("despesa");
  const { formatar } = usePrivacidadeValores();
  const mesAtual = useCompetenciaVigente();
  // 07/11/2026: resultado de cada mês = previsto no fim do ciclo (numeros-ciclo.ts), igual ao Início.
  const { dados: dadosCiclo, caixinhas: caixinhasCiclo, diaVirada: diaViradaCiclo } = useDadosCiclo();
  // 07/11/2026: regra "Somar transferências" (Personalização). Tabela de contas pendente: ignora.
  const { prefs } = usePreferencias();
  const { transferencias, tabelaPendente: transferenciasPendentes } = useTransferencias();
  const transferenciasSaldo =
    prefs.somar_transferencias && !transferenciasPendentes ? transferencias : undefined;
  // 07/11/2026: regra "Somar investimentos": aportes são saídas e resgates entradas no Resumo e no Saldo.
  const { data: investimentos = [] } = useInvestimentos();
  const movimentosInvest = useMemo(
    () => (prefs.somar_investimentos ? movimentosDeInvestimentos(investimentos as any[]) : undefined),
    [prefs.somar_investimentos, investimentos],
  );

  const [aba, setAba] = useState<Aba>("resumo");
  const [periodo, setPeriodo] = useState<Periodo>("atual");
  const [mesInicio, setMesInicio] = useState(mesAtual);
  const [mesFim, setMesFim] = useState(mesAtual);

  const competencias = useMemo(() => {
    if (periodo === "passado") return [somarMeses(mesAtual, -1)];
    if (periodo === "3m") return ultimasCompetencias(mesAtual, 3);
    if (periodo === "custom") return intervaloCompetencias(mesInicio, mesFim);
    return [mesAtual];
  }, [periodo, mesAtual, mesInicio, mesFim]);
  const fimPeriodo = competencias[competencias.length - 1] ?? mesAtual;
  const { sobraDe, numerosDe } = useMemo(() => {
    const metaDe = (m: string) => metaDoMes(caixinhasCiclo, m);
    const janela = new Set<string>();
    for (let i = -12; i <= 12; i++) janela.add(somarMeses(mesAtual, i));
    for (let i = -6; i <= 0; i++) janela.add(somarMeses(fimPeriodo, i));
    const mapa = calcularNumerosDosCiclos(dadosCiclo, [...janela], metaDe, diaViradaCiclo);
    const numerosDe = (c: string) => mapa.get(c) ?? calcularNumerosCiclo(dadosCiclo, c, metaDe(c), diaViradaCiclo);
    return { numerosDe, sobraDe: (c: string) => numerosDe(c).previsto.sobra };
  }, [dadosCiclo, caixinhasCiclo, diaViradaCiclo, mesAtual, fimPeriodo]);

  const cartoesCredito = useMemo(
    () => new Set((cartoes as any[]).filter((c) => (c.tipo ?? "credito") === "credito").map((c) => String(c.id))),
    [cartoes],
  );

  /** Uma janela só para todas as abas: período, 6 meses de histórico e até 12 meses à frente. */
  const janela = useMemo(() => {
    const s = new Set<string>(competencias);
    for (const c of ultimasCompetencias(fimPeriodo, 6)) s.add(c);
    for (const c of ultimasCompetencias(somarMeses(mesAtual, -1), 6)) s.add(c);
    for (let i = 0; i < 12; i++) s.add(somarMeses(mesAtual, i));
    return [...s].sort();
  }, [competencias, fimPeriodo, mesAtual]);

  // 07/11/2026: regra "Somar pagamento de fatura" (padrão desligada: pagamento de fatura fora dos totais).
  const somarPagamentoFatura = prefs.somar_pagamento_fatura;
  const opcoes = useMemo(
    () => ({ cotacao, macroDe, cartoesCredito, somarPagamentoFatura }),
    [cotacao, macroDe, cartoesCredito, somarPagamentoFatura],
  );
  const desp = useMemo(
    () => despesasPorCompetencia(despesas as any[], faturasMes as any[], janela, opcoes),
    [despesas, faturasMes, janela, opcoes],
  );
  const rec = useMemo(() => receitasDaCompetencia(receitas as any[], janela, cotacao), [receitas, janela, cotacao]);

  const noPeriodo = useMemo(() => {
    const s = new Set(competencias);
    return {
      desp: desp.filter((d) => s.has(d.competencia)),
      rec: rec.filter((r) => s.has(r.competencia)),
      invest: movimentosInvest ? totaisInvestimentos(movimentosInvest, (data) => s.has(competenciaDoDia(data))) : undefined,
    };
  }, [desp, rec, competencias, movimentosInvest]);

  const rotuloPeriodo =
    competencias.length === 1
      ? monthLabelLong(competencias[0]!)
      : `${monthLabel(competencias[0]!)} a ${monthLabel(fimPeriodo)}`;

  function escolherMes(key: string) {
    setPeriodo("custom");
    setMesInicio(key);
    setMesFim(key);
  }

  const mostraPeriodo = aba !== "previsao" && aba !== "parcelas";

  return (
    <AppLayout title="Relatórios" description="Seu dinheiro visto por período, categoria, saldo, previsão e parcelas.">
      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
          <TabsList className="w-max">
            {ABAS.map((a) => (
              <TabsTrigger key={a.value} value={a.value}>
                {a.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {mostraPeriodo && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-10 w-[190px] rounded-full" aria-label="Período">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {periodo === "custom" && (
              <div className="flex items-center gap-2">
                <MonthPicker value={mesInicio} onChange={setMesInicio} ariaLabel="Mês inicial" />
                <span className="text-sm text-muted-foreground">até</span>
                <MonthPicker value={mesFim} onChange={setMesFim} ariaLabel="Mês final" />
              </div>
            )}
            <span className="text-sm text-muted-foreground">{rotuloPeriodo}</span>
          </div>
        )}

        {!prontas ? (
          <>
            <CartaoCarregando />
            <CartaoCarregando />
          </>
        ) : (
          <>
            <TabsContent value="resumo">
              <AbaResumo
                desp={noPeriodo.desp}
                rec={noPeriodo.rec}
                investimentos={noPeriodo.invest}
                numeros={competencias.length === 1 ? numerosDe(competencias[0]!) : null}
                sobraPeriodo={competencias.reduce((acc, k) => acc + sobraDe(k), 0)}
                serie={seriePorMes(ultimasCompetencias(fimPeriodo, 6), desp, rec, sobraDe)}
                periodoSel={competencias}
                onVerCategorias={() => setAba("categorias")}
                onMes={escolherMes}
                formatar={formatar}
              />
            </TabsContent>
            <TabsContent value="categorias">
              <AbaCategorias desp={noPeriodo.desp} mes={fimPeriodo} formatar={formatar} />
            </TabsContent>
            <TabsContent value="saldo">
              <AbaSaldo
                dias={saldoDiario(competencias, noPeriodo.desp, noPeriodo.rec, {
                  transferencias: transferenciasSaldo,
                  investimentos: movimentosInvest,
                })}
                serie={seriePorMes(ultimasCompetencias(fimPeriodo, 6), desp, rec, sobraDe)}
                formatar={formatar}
              />
            </TabsContent>
            <TabsContent value="previsao">
              <AbaPrevisao desp={desp} rec={rec} mesAtual={mesAtual} formatar={formatar} sobraDe={sobraDe} />
            </TabsContent>
            <TabsContent value="parcelas">
              <AbaParcelas
                despesas={despesas as any[]}
                faturasMes={faturasMes as any[]}
                opcoes={opcoes}
                mesAtual={mesAtual}
                formatar={formatar}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </AppLayout>
  );
}

type Fmt = (v: number | null | undefined) => string;

/* ---------- Peças visuais ---------- */

function Painel({ titulo, acao, children, className }: { titulo?: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("rounded-3xl", className)}>
      <CardContent className="p-5 sm:p-6">
        {(titulo || acao) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {titulo && <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>}
            {acao}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function Indicador({ rotulo, valor, tom, dica }: { rotulo: string; valor: string; tom?: "success" | "destructive" | "primary"; dica?: string }) {
  return (
    <Card className="rounded-3xl">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
        <p
          className={cn(
            "mt-1 text-xl font-bold tracking-tight tabular-nums sm:text-2xl",
            tom === "success" && "text-success",
            tom === "destructive" && "text-destructive",
            tom === "primary" && "text-primary",
          )}
        >
          {valor}
        </p>
        {dica && <p className="mt-1 text-xs text-muted-foreground">{dica}</p>}
      </CardContent>
    </Card>
  );
}

function Vazio({ icone: Icone, texto }: { icone: ComponentType<{ className?: string }>; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icone className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

function ListaBarras({
  itens,
  formatar,
  cor = "bg-primary",
  linkPara,
}: {
  itens: Fatia[];
  formatar: Fmt;
  cor?: string;
  linkPara?: (nome: string) => { busca: string; mes: string };
}) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="space-y-3">
      {itens.map((i) => {
        const conteudo = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{i.nome}</span>
              <span className="shrink-0 tabular-nums">
                {formatar(i.valor)} <span className="text-xs text-muted-foreground">{i.pct.toFixed(1).replace(".", ",")}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", cor)} style={{ width: `${Math.max(2, (i.valor / max) * 100)}%` }} />
            </div>
          </>
        );
        return (
          <li key={i.nome}>
            {linkPara ? (
              <Link to="/despesas" search={linkPara(i.nome)} className="-mx-2 block rounded-2xl px-2 py-1 transition-colors hover:bg-muted/60">
                {conteudo}
              </Link>
            ) : (
              conteudo
            )}
          </li>
        );
      })}
    </ul>
  );
}

function tooltipBRL(formatar: Fmt) {
  return (v: any, n: any) => [formatar(Number(v)), n];
}

/* ---------- Resumo ---------- */

function AbaResumo({
  desp,
  rec,
  investimentos,
  numeros,
  sobraPeriodo,
  serie,
  periodoSel,
  onVerCategorias,
  onMes,
  formatar,
}: {
  desp: ReturnType<typeof despesasPorCompetencia>;
  rec: ReturnType<typeof receitasDaCompetencia>;
  /** Regra "Somar investimentos" ligada: resgates entram nas receitas e aportes nas despesas do período. */
  investimentos?: { entradas: number; saidas: number } | undefined;
  /** Números do ciclo quando o período é um ciclo só (Sobra até agora + Previsto). */
  numeros: NumerosCiclo | null;
  /** Soma do previsto no fim de cada ciclo do período. */
  sobraPeriodo: number;
  serie: ReturnType<typeof seriePorMes>;
  periodoSel: string[];
  onVerCategorias: () => void;
  onMes: (key: string) => void;
  formatar: Fmt;
}) {
  const totalRec = somar(rec) + (investimentos?.entradas ?? 0);
  const totalDesp = somar(desp) + (investimentos?.saidas ?? 0);
  const resultado = sobraPeriodo;
  const categorias = agrupar(desp, (d) => d.categoria);
  const receitasCat = agrupar(rec, (r) => r.categoria);
  const noCartao = somar(desp.filter((d) => d.noCartao));
  const naConta = somar(desp) - noCartao;
  const maiores = [...desp].sort((a, b) => b.valor - a.valor).slice(0, 5);
  const dadosGrafico = serie.map((l) => ({ ...l, mes: monthLabel(l.key), Receitas: l.receitas, Despesas: l.despesas }));

  if (!desp.length && !rec.length) {
    return (
      <Painel>
        <Vazio icone={ChartPie} texto="Nada lançado neste período. Escolha outro período ou cadastre receitas e despesas." />
      </Painel>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardContent className="p-6 sm:p-8">
          {numeros ? (
            <SobraCiclo numeros={numeros} formatar={formatar} tamanho="medio" />
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">Previsto no fim dos ciclos (soma)</p>
              <p className={cn("mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl", resultado >= 0 ? "text-success" : "text-destructive")}>
                {formatar(resultado)}
              </p>
            </>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10">
                <ArrowUpRight className="h-4 w-4 text-success" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="font-semibold tabular-nums">{formatar(totalRec)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="font-semibold tabular-nums">{formatar(totalDesp)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel
          titulo="Gastos por categoria"
          acao={
            categorias.length > 5 ? (
              <Button variant="ghost" size="sm" className="rounded-full" onClick={onVerCategorias}>
                Ver todos
              </Button>
            ) : undefined
          }
        >
          {categorias.length ? (
            <ListaBarras itens={categorias.slice(0, 5)} formatar={formatar} cor="bg-destructive/80" />
          ) : (
            <Vazio icone={ChartPie} texto="Sem gastos no período." />
          )}
        </Painel>

        <Painel titulo="Cartão x conta">
          {totalDesp > 0 ? (
            <div className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${(noCartao / totalDesp) * 100}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" /> No cartão de crédito
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatar(noCartao)}</p>
                  <p className="text-xs text-muted-foreground">{((noCartao / totalDesp) * 100).toFixed(0)}% dos gastos</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" /> Em conta, Pix e outros
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatar(naConta)}</p>
                  <p className="text-xs text-muted-foreground">{((naConta / totalDesp) * 100).toFixed(0)}% dos gastos</p>
                </div>
              </div>
            </div>
          ) : (
            <Vazio icone={CreditCard} texto="Sem gastos no período." />
          )}
        </Painel>

        <Painel titulo="Receitas por categoria">
          {receitasCat.length ? (
            <ListaBarras itens={receitasCat.slice(0, 6)} formatar={formatar} cor="bg-success/80" />
          ) : (
            <Vazio icone={ArrowUpRight} texto="Sem receitas no período." />
          )}
        </Painel>

        <Painel titulo="Maiores gastos">
          {maiores.length ? (
            <ul className="divide-y divide-border">
              {maiores.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.categoria} · {diaMes(m.vencimento)}
                      {m.total > 1 && m.natureza === "parcela" ? ` · ${m.numero}/${m.total}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-destructive">{formatar(m.valor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio icone={Receipt} texto="Sem gastos no período." />
          )}
        </Painel>
      </div>

      <Painel titulo="Receitas x despesas por mês">
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">Toque em um mês para ver só ele.</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dadosGrafico}
              onClick={(e: any) => {
                const key = e?.activePayload?.[0]?.payload?.key;
                if (key) onMes(key);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} />
              <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={abreviarValor} />
              <Tooltip formatter={tooltipBRL(formatar)} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Receitas" fill="var(--success)" radius={[6, 6, 0, 0]} maxBarSize={36} className="cursor-pointer">
                {dadosGrafico.map((l) => (
                  <Cell key={l.key} fillOpacity={periodoSel.includes(l.key) ? 1 : 0.45} />
                ))}
              </Bar>
              <Bar dataKey="Despesas" fill="var(--destructive)" radius={[6, 6, 0, 0]} maxBarSize={36} className="cursor-pointer">
                {dadosGrafico.map((l) => (
                  <Cell key={l.key} fillOpacity={periodoSel.includes(l.key) ? 1 : 0.45} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Painel>
    </div>
  );
}

/* ---------- Categorias ---------- */

function AbaCategorias({ desp: todasDesp, mes, formatar }: { desp: ReturnType<typeof despesasPorCompetencia>; mes: string; formatar: Fmt }) {
  const [modo, setModo] = useState<"categoria" | "subcategoria">("categoria");
  // 07/11/2026: filtro por essencial / não essencial (categorias.essencial). Só aparece com a coluna no banco.
  const { preferenciaDe, colunasPendentes } = useCategoriasPreferencias("despesa");
  const [essenciais, setEssenciais] = useState<"todos" | "sim" | "nao">("todos");
  const filtroAtivo = !colunasPendentes && essenciais !== "todos";
  const desp = filtroAtivo
    ? todasDesp.filter((d) => preferenciaDe(d.categoria).essencial === (essenciais === "sim"))
    : todasDesp;
  const temSub = desp.some((d) => d.subcategoria);
  const itens =
    modo === "subcategoria" && temSub
      ? agrupar(desp, (d) => (d.subcategoria ? `${d.categoria} · ${d.subcategoria}` : d.categoria))
      : agrupar(desp, (d) => d.categoria);
  const total = somar(desp);

  return (
    <Painel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total no período</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-destructive">{formatar(total)}</p>
          {filtroAtivo && (
            <p className="text-xs text-muted-foreground">
              {essenciais === "sim" ? "Só categorias essenciais" : "Só categorias não essenciais"} · {formatar(somar(todasDesp))} no total
            </p>
          )}
        </div>
        {!colunasPendentes && (
          <Tabs value={essenciais} onValueChange={(v) => setEssenciais(v as typeof essenciais)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="sim">Essenciais</TabsTrigger>
              <TabsTrigger value="nao">Não essenciais</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {temSub && (
          <Tabs value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
            <TabsList>
              <TabsTrigger value="categoria">Categorias</TabsTrigger>
              <TabsTrigger value="subcategoria">Subcategorias</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      {itens.length ? (
        <>
          <ListaBarras
            itens={itens}
            formatar={formatar}
            cor="bg-primary"
            linkPara={(nome) => ({ busca: nome.split(" · ").pop() ?? nome, mes })}
          />
          <p className="mt-4 text-xs text-muted-foreground">Toque em uma linha para ver os lançamentos em Despesas.</p>
        </>
      ) : (
        <Vazio
          icone={Layers}
          texto={
            filtroAtivo
              ? `Sem gastos em categorias ${essenciais === "sim" ? "essenciais" : "não essenciais"} no período. Marque as categorias em Categorias.`
              : "Sem gastos no período."
          }
        />
      )}
    </Painel>
  );
}

/* ---------- Saldo ---------- */

function AbaSaldo({ dias, serie, formatar }: { dias: ReturnType<typeof saldoDiario>; serie: ReturnType<typeof seriePorMes>; formatar: Fmt }) {
  const entradas = dias.reduce((s, d) => s + d.entradas, 0);
  const saidas = dias.reduce((s, d) => s + d.saidas, 0);
  const final = dias[dias.length - 1]?.saldo ?? 0;
  const menor = dias.reduce<(typeof dias)[number] | null>((m, d) => (!m || d.saldo < m.saldo ? d : m), null);
  const dados = dias.map((d) => ({ ...d, rotulo: diaMes(d.data), Entradas: d.entradas, Saídas: d.saidas, Saldo: d.saldo }));
  const meses = serie.map((l) => ({ mes: monthLabel(l.key), Entradas: l.receitas, Saídas: l.despesas, Resultado: l.resultado }));

  if (!entradas && !saidas) {
    return (
      <Painel>
        <Vazio icone={IconeLinha} texto="Sem movimentações neste período para montar o saldo." />
      </Painel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Saldo final do período" valor={formatar(final)} tom={final >= 0 ? "success" : "destructive"} dica="Começando do zero" />
        <Indicador rotulo="Entradas" valor={formatar(entradas)} tom="success" />
        <Indicador rotulo="Saídas" valor={formatar(saidas)} tom="destructive" />
        <Indicador
          rotulo="Previsto para sobrar"
          valor={formatar(serie[serie.length - 1]?.resultado ?? 0)}
          tom={(serie[serie.length - 1]?.resultado ?? 0) >= 0 ? "success" : "destructive"}
          dica={serie.length ? monthLabel(serie[serie.length - 1]!.key) : ""}
        />
      </div>

      <Painel
        titulo="Saldo acumulado"
        acao={menor ? <span className="text-xs text-muted-foreground">Menor saldo em {diaMes(menor.data)}: {formatar(menor.saldo)}</span> : undefined}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados}>
              <defs>
                <linearGradient id="relSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={abreviarValor} />
              <Tooltip formatter={tooltipBRL(formatar)} />
              <Area type="monotone" dataKey="Saldo" stroke="var(--primary)" strokeWidth={2} fill="url(#relSaldo)" isAnimationActive={false} />
              {menor && <ReferenceDot x={diaMes(menor.data)} y={menor.saldo} r={5} fill="var(--destructive)" stroke="var(--background)" />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Painel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Fluxo diário">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={abreviarValor} />
                <Tooltip formatter={tooltipBRL(formatar)} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Saídas" fill="var(--destructive)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Painel>
        <Painel titulo="Últimos 6 meses">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={meses}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} />
                <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={abreviarValor} />
                <Tooltip formatter={tooltipBRL(formatar)} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entradas" fill="var(--success)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Saídas" fill="var(--destructive)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="Resultado" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Painel>
      </div>
    </div>
  );
}

/* ---------- Previsão ---------- */

function AbaPrevisao({
  desp,
  rec,
  mesAtual,
  formatar,
  sobraDe,
}: {
  desp: ReturnType<typeof despesasPorCompetencia>;
  rec: ReturnType<typeof receitasDaCompetencia>;
  mesAtual: string;
  formatar: Fmt;
  sobraDe: (competencia: string) => number;
}) {
  const [horizonte, setHorizonte] = useState<"3" | "12">("3");
  const [estimarVariaveis, setEstimarVariaveis] = useState(true);
  const [mesSel, setMesSel] = useState<string | null>(null);

  const historico = ultimasCompetencias(somarMeses(mesAtual, -1), 6);
  const hist = seriePorMes(historico, desp, rec, sobraDe);
  const mediaRec = hist.reduce((s, l) => s + l.receitas, 0) / hist.length;
  const mediaDesp = hist.reduce((s, l) => s + l.despesas, 0) / hist.length;
  const mediaVar =
    historico.reduce((s, c) => s + somar(desp.filter((d) => d.competencia === c && d.natureza === "variavel")), 0) / historico.length;

  const meses = Array.from({ length: Number(horizonte) }, (_, i) => somarMeses(mesAtual, i));
  let acumulado = 0;
  const linhas = meses.map((key) => {
    const r = rec.filter((x) => x.competencia === key);
    const d = desp.filter((x) => x.competencia === key);
    const parcelas = somar(d.filter((x) => x.natureza === "parcela"));
    const fixas = somar(d.filter((x) => x.natureza === "fixa"));
    const lancadas = somar(d.filter((x) => x.natureza === "variavel"));
    const variaveis = estimarVariaveis ? Math.max(lancadas, mediaVar) : lancadas;
    const receitas = somar(r);
    const despesas = parcelas + fixas + variaveis;
    // 07/11/2026: o resultado do mês é o previsto de numeros-ciclo.ts; a simulação de variáveis só desconta a diferença.
    const resultado = sobraDe(key) - (variaveis - lancadas);
    acumulado += resultado;
    return { key, mes: monthLabel(key), receitas, parcelas, fixas, variaveis, despesas, resultado, acumulado, itensRec: r };
  });
  const sel = linhas.find((l) => l.key === mesSel) ?? linhas[0]!;
  const vazio = !rec.length && !desp.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={horizonte} onValueChange={(v) => setHorizonte(v as "3" | "12")}>
          <TabsList>
            <TabsTrigger value="3">3 meses</TabsTrigger>
            <TabsTrigger value="12">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={estimarVariaveis} onCheckedChange={setEstimarVariaveis} />
          Estimar gastos variáveis pela média
        </label>
      </div>

      {vazio ? (
        <Painel>
          <Vazio icone={Telescope} texto="Cadastre receitas fixas, recorrências ou compras parceladas para ver a previsão." />
        </Painel>
      ) : (
        <>
          <Painel titulo="Saldo previsto mês a mês">
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">Barras: resultado do mês. Linha: acumulado. Toque em um mês para ver o detalhe.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={linhas}
                  onClick={(e: any) => {
                    const key = e?.activePayload?.[0]?.payload?.key;
                    if (key) setMesSel(key);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} />
                  <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={abreviarValor} />
                  <Tooltip formatter={tooltipBRL(formatar)} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="resultado" name="Resultado" radius={[6, 6, 0, 0]} maxBarSize={36} className="cursor-pointer">
                    {linhas.map((l) => (
                      <Cell
                        key={l.key}
                        fill={l.resultado >= 0 ? "var(--success)" : "var(--destructive)"}
                        fillOpacity={l.key === sel.key ? 1 : 0.5}
                      />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Painel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Painel titulo={`Detalhe de ${monthLabelLong(sel.key)}`}>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="flex justify-between font-semibold">
                    <span>Receitas previstas</span>
                    <span className="tabular-nums text-success">{formatar(sel.receitas)}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {sel.itensRec.slice(0, 6).map((r) => (
                      <li key={r.id} className="flex justify-between gap-3">
                        <span className="truncate">{r.descricao}</span>
                        <span className="tabular-nums">{formatar(r.valor)}</span>
                      </li>
                    ))}
                    {!sel.itensRec.length && <li>Nenhuma receita prevista.</li>}
                  </ul>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Despesas previstas</span>
                    <span className="tabular-nums text-destructive">{formatar(sel.despesas)}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li className="flex justify-between"><span>Parcelas</span><span className="tabular-nums">{formatar(sel.parcelas)}</span></li>
                    <li className="flex justify-between"><span>Recorrentes e fixas</span><span className="tabular-nums">{formatar(sel.fixas)}</span></li>
                    <li className="flex justify-between">
                      <span>Variáveis{estimarVariaveis ? " (média ou lançado)" : ""}</span>
                      <span className="tabular-nums">{formatar(sel.variaveis)}</span>
                    </li>
                  </ul>
                </div>
                <div className="flex justify-between border-t border-border pt-3 font-semibold">
                  <span>Resultado</span>
                  <span className={cn("tabular-nums", sel.resultado >= 0 ? "text-success" : "text-destructive")}>{formatar(sel.resultado)}</span>
                </div>
              </div>
            </Painel>
            <Painel titulo="Médias dos últimos 6 meses">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-xs text-muted-foreground">Receitas</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-success">{formatar(mediaRec)}</p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-xs text-muted-foreground">Gastos</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-destructive">{formatar(mediaDesp)}</p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <p className={cn("mt-1 text-lg font-semibold tabular-nums", mediaRec - mediaDesp >= 0 ? "text-success" : "text-destructive")}>
                    {formatar(mediaRec - mediaDesp)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                De {monthLabel(historico[0]!)} a {monthLabel(historico[historico.length - 1]!)}. Média de variáveis usada na estimativa: {formatar(mediaVar)}.
              </p>
            </Painel>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Parcelas ---------- */

type Ordem = "saldo" | "termina" | "proxima";

function AbaParcelas({
  despesas,
  faturasMes,
  opcoes,
  mesAtual,
  formatar,
}: {
  despesas: any[];
  faturasMes: any[];
  opcoes: Parameters<typeof despesasPorCompetencia>[3];
  mesAtual: string;
  formatar: Fmt;
}) {
  const [ordem, setOrdem] = useState<Ordem>("saldo");
  const itens = useMemo(() => {
    const parceladas = despesas.filter((d) => naturezaDaDespesa(d) === "parcela");
    return despesasPorCompetencia(parceladas, faturasMes, competenciasDasParceladas(parceladas), opcoes);
  }, [despesas, faturasMes, opcoes]);
  const lista = useMemo(() => resumirParcelamentos(itens, mesAtual), [itens, mesAtual]);
  const ordenada = useMemo(() => {
    const l = [...lista];
    if (ordem === "saldo") l.sort((a, b) => b.faltaPagar - a.faltaPagar);
    if (ordem === "termina") l.sort((a, b) => a.termina.localeCompare(b.termina));
    if (ordem === "proxima") l.sort((a, b) => (a.proxima ?? "").localeCompare(b.proxima ?? "") || b.valorParcela - a.valorParcela);
    return l;
  }, [lista, ordem]);

  const ativos = new Set(lista.map((p) => p.despesaId));
  const doAtivo = itens.filter((i) => ativos.has(i.despesaId));
  const faltaPagar = lista.reduce((s, p) => s + p.faltaPagar, 0);
  const jaPago = lista.reduce((s, p) => s + p.jaPago, 0);
  const restantes = lista.reduce((s, p) => s + p.restantes, 0);
  const proximo = somarMeses(mesAtual, 1);
  const esteMes = somar(doAtivo.filter((i) => i.competencia === mesAtual));
  const proxMes = somar(doAtivo.filter((i) => i.competencia === proximo));
  const compromisso = Array.from({ length: 12 }, (_, i) => {
    const key = somarMeses(mesAtual, i);
    return { key, mes: monthLabel(key), Parcelas: somar(doAtivo.filter((x) => x.competencia === key)) };
  });

  if (!lista.length) {
    return (
      <Painel>
        <Vazio icone={CalendarRange} texto="Nenhuma compra parcelada em aberto. Quando houver, ela aparece aqui com as parcelas que faltam." />
      </Painel>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardContent className="p-6 sm:p-8">
          <p className="text-sm font-medium text-muted-foreground">Falta pagar</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-destructive sm:text-5xl">{formatar(faltaPagar)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {lista.length} {lista.length === 1 ? "parcelamento ativo" : "parcelamentos ativos"} · {restantes}{" "}
            {restantes === 1 ? "parcela restante" : "parcelas restantes"}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="Já pago" valor={formatar(jaPago)} tom="success" />
        <Indicador rotulo="Este mês" valor={formatar(esteMes)} dica={monthLabelLong(mesAtual)} />
        <Indicador rotulo="Próximo mês" valor={formatar(proxMes)} dica={monthLabelLong(proximo)} />
      </div>

      <Painel titulo="Compromisso mensal">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compromisso}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} />
              <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={abreviarValor} />
              <Tooltip formatter={tooltipBRL(formatar)} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar dataKey="Parcelas" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Painel>

      <Painel
        titulo="Parcelamentos"
        acao={
          <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
            <SelectTrigger className="h-9 w-[170px] rounded-full" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saldo">Maior saldo</SelectItem>
              <SelectItem value="termina">Termina antes</SelectItem>
              <SelectItem value="proxima">Próxima parcela</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <ul className="divide-y divide-border">
          {ordenada.map((p) => (
            <LinhaParcelamento key={p.despesaId} p={p} formatar={formatar} />
          ))}
        </ul>
      </Painel>
    </div>
  );
}

function LinhaParcelamento({ p, formatar }: { p: Parcelamento; formatar: Fmt }) {
  const pct = p.total > 0 ? (p.pagas / p.total) * 100 : 0;
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{p.descricao}</p>
          <p className="text-xs text-muted-foreground">
            {p.pagas}/{p.total} pagas · {formatar(p.valorParcela)} por mês · termina em {monthLabel(p.termina)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{formatar(p.faltaPagar)}</p>
          {p.proxima && <p className="text-xs text-muted-foreground">Próxima: {monthLabel(p.proxima)}</p>}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
