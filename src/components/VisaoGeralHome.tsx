import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, Eye, EyeOff, Minus } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditarDespesaRapido } from "@/components/EditarDespesaRapido";
import { Button } from "@/components/ui/button";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import {
  formatBRL,
  formatDate,
  identificacaoDespesa,
  monthKey,
  monthLabel,
  monthLabelLong,
  toBRL,
} from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { usePersistedState } from "@/hooks/usePersistedState";
import { abreviarValor } from "@/lib/format";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";
import { opacidadePorPosicao, posicaoTemporalDoMes } from "@/lib/tempo-visual";

type Agrupamento = "cartao" | "categoria" | "responsavel" | "tipo";

const AGRUPAMENTOS: { value: Agrupamento; label: string }[] = [
  { value: "cartao", label: "Por cartão / banco" },
  { value: "categoria", label: "Por categoria" },
  { value: "responsavel", label: "Por responsável" },
  { value: "tipo", label: "Fixos x variáveis" },
];

function nomeCartao(d: any): string {
  if (d.cartoes) {
    const nome = d.cartoes.apelido || "Cartão";
    const titular = d.cartoes.titular?.trim().split(/\s+/)[0];
    return `${d.cartoes.final ? `${nome} •${d.cartoes.final}` : nome}${titular ? ` · ${titular}` : ""}`;
  }
  if (d.bancos?.nome) return d.bancos.nome;
  if (d.banco_nome) return d.banco_nome;
  // Despesas fixas (recorrentes) sem cartão têm rótulo específico
  if (d.tipo === "fixa" || d.tipo === "recorrente") return "Recorrente fora do cartão";
  return "Sem cartão / dinheiro";
}

function mesAnteriorDe(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y!, m! - 2, 1));
}

/** Variação percentual entre dois valores; null quando não há base de comparação. */
function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0.005) return null;
  return ((atual - anterior) / anterior) * 100;
}

function Delta({ valor }: { valor: number | null }) {
  if (valor == null)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="size-3" /> novo
      </span>
    );
  const sobe = valor >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        sobe ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
      }`}
    >
      {sobe ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(valor).toFixed(0)}%
    </span>
  );
}

/** Botão "olho" pequeno, usado por caixa/card individual — sobrepõe o
 * global só para aquele item (item 4 do backlog 2026-09-27). */
function BotaoOlhoItem({ oculto, onClick }: { oculto: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 shrink-0 text-muted-foreground"
      onClick={onClick}
      aria-label={oculto ? "Mostrar valores desta caixa" : "Ocultar valores desta caixa"}
      title={oculto ? "Mostrar valores desta caixa" : "Ocultar valores desta caixa"}
    >
      {oculto ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </Button>
  );
}

export function VisaoGeralHome({ ocultarValores }: { ocultarValores?: boolean } = {}) {
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: receitas = [] } = useReceitas();

  // `ocultarValores` explícito (prop) continua funcionando pra quem já
  // chamava assim; sem prop, cada card decide sozinho via seu próprio
  // hook (global + override por item).
  const globalHook = usePrivacidadeValores();
  const economiaPrivacidade = usePrivacidadeValores("economia-conquistada");
  const receitasPrivacidade = usePrivacidadeValores("receitas-home");
  const despesasPrivacidade = usePrivacidadeValores("despesas-home");

  const ocultoEconomia = ocultarValores ?? economiaPrivacidade.ocultoNesteItem;
  const ocultoReceitas = ocultarValores ?? receitasPrivacidade.ocultoNesteItem;
  const ocultoDespesas = ocultarValores ?? despesasPrivacidade.ocultoNesteItem;
  const valorFmt = (v: number) => (globalHook.ocultarValores ? "R$ ••••••" : formatBRL(v));
  const valorFmtItem = (v: number, oculto: boolean) => (oculto ? "R$ ••••••" : formatBRL(v));

  // Item 3 (backlog 2026-09-27): agrupamento lembrado por sessão
  // (localStorage) e restaurado quando o usuário volta pra tela.
  const [agrupamento, setAgrupamento] = usePersistedState<Agrupamento>(
    "inicio.agrupamento",
    "cartao",
  );
  // Item 5 (backlog 2026-09-27): "mês do sistema" — `mes` inicia (e se
  // realinha, caso a preferência de dia de virada ainda esteja carregando no
  // primeiro render) com a competência vigente considerando o dia de virada
  // configurado pelo usuário em Minha Conta. Sem configuração, comporta-se
  // exatamente como antes (mês calendário normal).
  const competenciaVigente = useCompetenciaVigente();
  const [mes, setMes] = useState(competenciaVigente);
  useEffect(() => {
    setMes(competenciaVigente);
  }, [competenciaVigente]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [editando, setEditando] = useState<any | null>(null);

  const grupoDe = useMemo(
    () => (d: any) =>
      agrupamento === "cartao"
        ? nomeCartao(d)
        : agrupamento === "categoria"
          ? (d.categoria ?? "outros")
          : agrupamento === "responsavel"
            ? (d.responsavel ?? "Sem responsável")
            : d.tipo === "fixa"
              ? "Gastos fixos"
              : "Gastos variáveis",
    [agrupamento],
  );

  /** 7 meses: o anterior, o atual e 5 à frente (item 10, 2026-10-05). */
  const meses = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) =>
      monthKey(new Date(now.getFullYear(), now.getMonth() - 1 + i, 1)),
    );
  }, []);

  const parcelas = useMemo(
    () =>
      aplicarRegrasFaturaMes(
        lancamentosPorCompetencias(despesas as any[], meses),
        faturasMes as any[],
      ),
    [despesas, meses, faturasMes],
  );

  const serie = useMemo(() => {
    return meses.map((key) => {
      const des = parcelas
        .filter((p) => monthKey(p.vencimento) === key)
        .reduce((s, p) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);
      const rec = (receitas as any[])
        .filter((r) => monthKey(r.data_recebimento) === key)
        .reduce((s, r) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
      return {
        key,
        mes: monthLabel(key),
        Despesas: Number(des.toFixed(2)),
        Receitas: Number(rec.toFixed(2)),
        Saldo: Number((rec - des).toFixed(2)),
        // % da renda do mês já comprometida com despesas — null quando não há
        // renda cadastrada naquele mês (não dá pra calcular percentual).
        Comprometido: rec > 0 ? Number(((des / rec) * 100).toFixed(1)) : null,
      };
    });
  }, [meses, parcelas, receitas, cotacao]);

  const mesSelecionado = serie.find((s) => s.key === mes) ?? null;

  const comGasto = serie.filter((s) => s.Despesas > 0);
  const menor = comGasto.length
    ? comGasto.reduce((a, b) => (b.Despesas < a.Despesas ? b : a))
    : null;
  const maior = comGasto.length
    ? comGasto.reduce((a, b) => (b.Despesas > a.Despesas ? b : a))
    : null;

  const grupos = useMemo(() => {
    const anterior = mesAnteriorDe(mes);
    const atualMap = new Map<string, { total: number; itens: any[] }>();
    const antMap = new Map<string, number>();
    for (const p of parcelas) {
      const mk = monthKey(p.vencimento);
      const v = toBRL(Number(p.valor), p.despesa.moeda, cotacao);
      const g = grupoDe(p.despesa);
      if (mk === mes) {
        const cur = atualMap.get(g) ?? { total: 0, itens: [] };
        cur.total += v;
        cur.itens.push({ ...p, valorBRL: v });
        atualMap.set(g, cur);
      } else if (mk === anterior) {
        antMap.set(g, (antMap.get(g) ?? 0) + v);
      }
    }
    const lista = Array.from(atualMap, ([grupo, v]) => ({
      grupo,
      total: v.total,
      itens: v.itens.sort((a, b) => b.valorBRL - a.valorBRL),
      delta: variacao(v.total, antMap.get(grupo) ?? 0),
    })).sort((a, b) => b.total - a.total);
    const total = lista.reduce((s, g) => s + g.total, 0);
    const totalAnterior = Array.from(antMap.values()).reduce((s, v) => s + v, 0);
    return { lista, total, deltaTotal: variacao(total, totalAnterior) };
  }, [parcelas, grupoDe, mes, cotacao]);

  const economiaTotal = useMemo(() => {
    return (despesas as any[])
      .filter((d) => d.economia_conquistada)
      .reduce((s, d) => s + toBRL(Number(d.valor_total ?? 0), d.moeda ?? "BRL", cotacao), 0);
  }, [despesas, cotacao]);

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className="border-emerald-500/20 bg-emerald-500/5 transition-colors hover:bg-emerald-500/10">
          <Link
            to="/despesas"
            search={{ economia: true, mes: "todos" }}
            className="block focus-visible:outline-none"
            title="Economizado em tarifas, anuidades e cobranças renegociadas"
          >
            <CardContent className="px-3 py-2">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Economia conquistada
                </p>
                {!ocultarValores && (
                  <BotaoOlhoItem oculto={ocultoEconomia} onClick={economiaPrivacidade.toggleItem} />
                )}
              </div>
              <h3 className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {valorFmtItem(economiaTotal, ocultoEconomia)}
              </h3>
            </CardContent>
          </Link>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Comunidade Control ALL
            </p>
            <h3 className="text-base font-bold text-blue-700 dark:text-blue-300">Organização ativa</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Linha do tempo — 12 meses</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {menor && (
              <Badge variant="outline" className="border-success/40 text-success">
                Mês mais leve: {monthLabel(menor.key)} · {valorFmt(menor.Despesas)}
              </Badge>
            )}
            {maior && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                Mais pesado: {monthLabel(maior.key)} · {valorFmt(maior.Despesas)}
              </Badge>
            )}
            {mesSelecionado?.Comprometido != null && (
              <Badge
                variant="outline"
                className={
                  mesSelecionado.Comprometido >= 100
                    ? "border-destructive/40 text-destructive"
                    : mesSelecionado.Comprometido >= 70
                      ? "border-warning/40 text-warning"
                      : "border-success/40 text-success"
                }
              >
                Renda comprometida em {monthLabel(mesSelecionado.key)}:{" "}
                {mesSelecionado.Comprometido.toFixed(0)}%
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={serie}
                margin={{ top: 26, right: 8, left: 8, bottom: 0 }}
                onClick={(e: any) => {
                  const k = e?.activePayload?.[0]?.payload?.key;
                  if (k) setMes(k);
                }}
              >
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis hide domain={[0, (max: number) => Math.ceil(max * 1.2)]} />
                <YAxis yAxisId="pct" hide domain={[0, "dataMax + 20"]} />
                <Tooltip
                  formatter={(v: any, n: any) =>
                    n === "Renda comprometida"
                      ? [v == null ? "sem renda no mês" : `${Number(v).toFixed(0)}%`, n]
                      : [valorFmt(Number(v)), n]
                  }
                  labelFormatter={(l: any) => String(l)}
                />
                <Bar dataKey="Despesas" radius={[6, 6, 0, 0]} maxBarSize={38} cursor="pointer" isAnimationActive={false}>
                  {serie.map((s) => (
                    <Cell
                      key={s.key}
                      fill={
                        s.key === mes
                          ? "var(--primary)"
                          : s.key === maior?.key
                            ? "var(--destructive)"
                            : s.key === menor?.key
                              ? "var(--success)"
                              : "var(--chart-2)"
                      }
                      // Bloco 3 (plano-mega 2026-09-14): mês selecionado sempre
                      // em destaque total; os demais usam a opacidade padrão de
                      // passado/futuro em vez de um valor fixo — assim um mês
                      // futuro (ainda "previsto") fica visualmente mais apagado
                      // que um mês passado já fechado.
                      opacity={
                        s.key === mes
                          ? 1
                          : opacidadePorPosicao(posicaoTemporalDoMes(s.key, competenciaVigente))
                      }
                    />
                  ))}
                  <LabelList dataKey="Despesas" position="top" fontSize={10} fill="var(--muted-foreground)" formatter={abreviarValor} />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="Comprometido"
                  name="Renda comprometida"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            Toque em um mês para ver os agrupamentos abaixo. Linha tracejada: % da renda do mês
            comprometida com despesas.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1">
              <CardTitle className="text-base">{monthLabelLong(mes)}</CardTitle>
              {!ocultarValores && (
                <BotaoOlhoItem oculto={ocultoDespesas} onClick={despesasPrivacidade.toggleItem} />
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              Total {valorFmtItem(grupos.total, ocultoDespesas)} <Delta valor={grupos.deltaTotal} /> vs. mês anterior
            </p>
            {mesSelecionado && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                Receita do mês: {valorFmtItem(mesSelecionado.Receitas, ocultoReceitas)}
                {!ocultarValores && (
                  <BotaoOlhoItem oculto={ocultoReceitas} onClick={receitasPrivacidade.toggleItem} />
                )}
              </p>
            )}
          </div>
          <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGRUPAMENTOS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          {grupos.lista.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum gasto neste mês.
            </p>
          )}
          {grupos.lista.map((g) => {
            const pct = grupos.total > 0 ? (g.total / grupos.total) * 100 : 0;
            const expandido = aberto === g.grupo;
            return (
              <div key={g.grupo} className="rounded-lg border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 p-3 text-left"
                  onClick={() => setAberto(expandido ? null : g.grupo)}
                >
                  {expandido ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{g.grupo}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {valorFmtItem(g.total, ocultoDespesas)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                        {pct.toFixed(0)}%
                      </span>
                      <Delta valor={g.delta} />
                    </div>
                  </div>
                </button>
                {expandido && (
                  <div className="border-t">
                    {g.itens.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditando(p.despesa)}
                        className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{p.despesa.descricao}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {formatDate(p.vencimento)}
                            {p.despesa.tipo === "fixa"
                              ? " · competência mensal"
                              : p.total > 1
                                ? ` · parcela ${p.numero}/${p.total}`
                                : ""}
                            {identificacaoDespesa(p.despesa)
                              ? ` · ${identificacaoDespesa(p.despesa)}`
                              : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {valorFmtItem(p.valorBRL, ocultoDespesas)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <EditarDespesaRapido despesa={editando} onClose={() => setEditando(null)} />
    </>
  );
}
