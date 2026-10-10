import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleHelp,
  PiggyBank,
  Repeat,
  Scissors,
  TrendingDown,
} from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCotacao } from "@/hooks/useCotacao";
import { useCategorias, useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { criarCorPorCategoria } from "@/lib/categorias-cor";
import { chaveEstabelecimento } from "@/lib/categorizacao";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { formatBRL, monthKey, monthLabel, monthLabelLong, toBRL } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";
import {
  detectarRecorrentes,
  gerarPerguntas,
  quadrosPorMes,
  recorrentesAtivos,
  recorrentesEncerrados,
  resumirPorCategoria,
  type GastoMes,
} from "@/lib/para-onde-vai";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/para-onde-vai")({
  head: () => ({
    meta: [
      { title: "Para onde vai meu dinheiro | Control ALL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParaOndeVaiPage,
});

const JANELAS = [
  { value: "12", label: "Últimos 12 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "3", label: "Últimos 3 meses" },
];

function ParaOndeVaiPage() {
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: receitas = [] } = useReceitas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: categoriasCadastradas = [] } = useCategorias("despesa");
  const { ocultarValores } = usePrivacidadeValores();
  const competenciaAtual = useCompetenciaVigente();
  const [janela, setJanela] = useState("12");
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);

  const fmt = (v: number) => (ocultarValores ? "R$ ••••••" : formatBRL(v));
  const corDe = useMemo(
    () => criarCorPorCategoria(categoriasCadastradas as any[]),
    [categoriasCadastradas],
  );

  /** Competências do período, da mais antiga até o mês atual. */
  const competencias = useMemo(() => {
    const n = Number(janela);
    const [ano, mes] = competenciaAtual.split("-").map(Number);
    return Array.from({ length: n }, (_, i) =>
      monthKey(new Date(ano!, mes! - 1 - (n - 1 - i), 1)),
    );
  }, [janela, competenciaAtual]);

  const parcelas = useMemo(
    () =>
      aplicarRegrasFaturaMes(
        lancamentosPorCompetencias(despesas as any[], competencias),
        faturasMes as any[],
      ),
    [despesas, competencias, faturasMes],
  );

  const gastos: GastoMes[] = useMemo(
    () =>
      parcelas
        .filter((p: any) => p.despesa?.direcao !== "credito" && !p.despesa?.economia_conquistada)
        .map((p: any) => ({
          competencia: monthKey(p.vencimento),
          categoria: p.despesa?.categoria || "outros",
          descricao: p.despesa?.descricao ?? "Sem descrição",
          chave: chaveEstabelecimento(
            p.despesa?.estabelecimento_normalizado || p.despesa?.descricao || "",
          ),
          valor: toBRL(Number(p.valor), p.despesa?.moeda ?? "BRL", cotacao),
          despesaId: String(p.despesa?.id ?? p.despesa_id ?? ""),
          tipo: p.despesa?.tipo ?? null,
          parcelado: Number(p.total ?? 1) > 1,
        })),
    [parcelas, cotacao],
  );

  const rendaMensal = useMemo(() => {
    const doMes = (receitas as any[]).filter(
      (r) => monthKey(r.data_recebimento) === competenciaAtual,
    );
    return doMes.reduce((s, r) => s + toBRL(Number(r.valor), r.moeda ?? "BRL", cotacao), 0);
  }, [receitas, competenciaAtual, cotacao]);

  const resumo = useMemo(
    () => resumirPorCategoria(gastos, competenciaAtual),
    [gastos, competenciaAtual],
  );
  const recorrentes = useMemo(
    () => detectarRecorrentes(gastos, competenciaAtual),
    [gastos, competenciaAtual],
  );
  const ativos = useMemo(() => recorrentesAtivos(recorrentes), [recorrentes]);
  const encerrados = useMemo(() => recorrentesEncerrados(recorrentes), [recorrentes]);
  const perguntas = useMemo(
    () => gerarPerguntas(resumo, recorrentes, rendaMensal, fmt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resumo, recorrentes, rendaMensal, ocultarValores],
  );
  const quadros = useMemo(
    () => quadrosPorMes(gastos, competencias),
    [gastos, competencias],
  );
  const totalPeriodo = resumo.reduce((s, r) => s + r.total, 0);
  const economiaDetectada = encerrados.reduce((s, r) => s + r.economiaAcumulada, 0);
  const maiorQuadro = Math.max(1, ...quadros.map((q) => q.total));

  const itensDaCategoria = useMemo(() => {
    if (!categoriaAberta) return [];
    const porChave = new Map<string, { descricao: string; total: number; meses: Set<string> }>();
    for (const g of gastos) {
      if ((g.categoria || "outros") !== categoriaAberta) continue;
      const atual = porChave.get(g.chave) ?? { descricao: g.descricao, total: 0, meses: new Set() };
      atual.total += g.valor;
      atual.meses.add(g.competencia);
      porChave.set(g.chave, atual);
    }
    return [...porChave.entries()]
      .map(([chave, v]) => ({
        chave,
        descricao: v.descricao,
        total: v.total,
        meses: v.meses.size,
        recorrente: recorrentes.find((r) => r.chave === chave) ?? null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [categoriaAberta, gastos, recorrentes]);

  const dadosTreemap = resumo.slice(0, 14).map((r) => ({
    name: r.categoria,
    size: Math.max(r.total, 0.01),
    valor: r.total,
    participacao: r.participacao,
    fill: corDe(r.categoria),
  }));

  return (
    <AppLayout
      title="Para onde vai meu dinheiro"
      description="Seus gastos por categoria, as cobranças que se repetem e o que já deixou de sair da sua conta."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={janela} onValueChange={setJanela}>
          <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="Período analisado">
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
        <span className="text-xs text-muted-foreground">
          {totalPeriodo > 0
            ? `${fmt(totalPeriodo)} no período, em ${resumo.length} categoria(s).`
            : "Ainda não há gastos lançados neste período."}
        </span>
      </div>

      {totalPeriodo === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Assim que você lançar ou importar despesas, esta tela mostra para onde o dinheiro está
            indo, quais cobranças se repetem todo mês e quanto você já deixou de gastar.{" "}
            <Link to="/despesas" className="font-medium text-primary underline-offset-2 hover:underline">
              Ir para Despesas
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {perguntas.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {perguntas.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    "border-l-4",
                    p.tom === "atencao"
                      ? "border-l-destructive"
                      : p.tom === "boa"
                        ? "border-l-success"
                        : "border-l-primary",
                  )}
                >
                  <CardContent className="space-y-1 p-4">
                    <p className="flex items-start gap-2 text-sm font-semibold">
                      <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {p.texto}
                    </p>
                    <p className="pl-6 text-xs text-muted-foreground">{p.detalhe}</p>
                    {p.categoria && (
                      <div className="pl-6">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 text-[11px]"
                          onClick={() => setCategoriaAberta(p.categoria)}
                        >
                          Ver o que entra em {p.categoria}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Onde o dinheiro foi parar</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cada retângulo é uma categoria. Quanto maior, mais pesou no período. Clique para ver
                o que entra nela.
              </p>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={dadosTreemap}
                  dataKey="size"
                  nameKey="name"
                  isAnimationActive={false}
                  stroke="var(--background)"
                  content={<CelulaTreemap fmt={fmt} onAbrir={setCategoriaAberta} />}
                >
                  <Tooltip
                    formatter={(_v: any, _n: any, item: any) => [
                      `${fmt(item?.payload?.valor ?? 0)} (${(item?.payload?.participacao ?? 0).toFixed(0)}%)`,
                      item?.payload?.name,
                    ]}
                  />
                </Treemap>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mês a mês</CardTitle>
              <p className="text-xs text-muted-foreground">
                Um quadro por mês, com o total e a categoria que mais pesou nele.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {quadros.map((q) => {
                  const atual = q.competencia === competenciaAtual;
                  const intensidade = q.total / maiorQuadro;
                  return (
                    <button
                      key={q.competencia}
                      type="button"
                      onClick={() => q.maiorCategoria && setCategoriaAberta(q.maiorCategoria)}
                      className={cn(
                        "rounded-lg border p-2 text-left transition-colors hover:bg-muted",
                        atual && "border-primary ring-1 ring-primary/40",
                      )}
                      style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(intensidade * 18)}%, transparent)` }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {monthLabel(q.competencia)}
                        {atual ? " · atual" : ""}
                      </p>
                      <p className="text-sm font-bold">{fmt(q.total)}</p>
                      {q.maiorCategoria && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {q.maiorCategoria} · {q.maiorPercentual.toFixed(0)}%
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Repeat className="size-4" aria-hidden="true" /> Cobranças que se repetem
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {ativos.length
                    ? `${ativos.length} cobrança(s) aparecem quase todo mês, somando ${fmt(
                        ativos.reduce((s, r) => s + r.valor, 0),
                      )} por mês.`
                    : "Ainda não identificamos cobranças mensais repetidas."}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {ativos.slice(0, 10).map((r) => (
                  <div key={r.chave} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      <b>{r.descricao}</b>
                      <span className="block text-xs text-muted-foreground">
                        {r.categoria} · {r.competencias.length} meses seguidos
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{fmt(r.valor)}/mês</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 text-[11px]"
                      asChild
                      title="Abrir a despesa para cancelar ou marcar como economia"
                    >
                      <Link to="/despesas" search={{ busca: r.descricao, mes: "todos" } as any}>
                        <Scissors className="mr-1 size-3.5" aria-hidden="true" /> Quero cancelar
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className={economiaDetectada > 0 ? "border-success/40 bg-success/5" : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PiggyBank className="size-4" aria-hidden="true" /> Economia que já aconteceu
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Cobranças que apareciam todo mês e pararam. Contamos a economia desde o mês em que
                  sumiram, sem você precisar marcar nada.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {economiaDetectada > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-success">{fmt(economiaDetectada)}</p>
                    {encerrados.slice(0, 8).map((r) => (
                      <div key={r.chave} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                          <b>{r.descricao}</b>
                          <span className="block text-xs text-muted-foreground">
                            {fmt(r.valor)}/mês · sumiu depois de {monthLabelLong(r.ultima)} ·{" "}
                            {r.mesesSemAparecer} mês(es) sem cobrar
                          </span>
                        </span>
                        <Badge variant="outline" className="shrink-0 border-success/40 text-success">
                          <TrendingDown className="mr-1 size-3" aria-hidden="true" />
                          {fmt(r.economiaAcumulada)}
                        </Badge>
                      </div>
                    ))}
                    <p className="text-[11px] text-muted-foreground">
                      Se a cobrança voltar a aparecer, ela sai desta lista sozinha.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma cobrança repetida parou de aparecer no período. Quando isso acontecer,
                    o valor economizado aparece aqui.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Categorias em números</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {resumo.map((r) => (
                <button
                  key={r.categoria}
                  type="button"
                  onClick={() => setCategoriaAberta(r.categoria)}
                  className="flex w-full flex-wrap items-center gap-2 rounded-lg border p-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: corDe(r.categoria) }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.categoria}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.participacao.toFixed(0)}% · média {fmt(r.media)}/mês
                  </span>
                  <span className="w-24 shrink-0 text-right font-semibold">{fmt(r.total)}</span>
                  {r.variacao != null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 gap-1",
                        r.variacao > 0 ? "border-destructive/40 text-destructive" : "border-success/40 text-success",
                      )}
                    >
                      {r.variacao > 0 ? (
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="size-3" aria-hidden="true" />
                      )}
                      {Math.abs(r.variacao).toFixed(0)}% no mês
                    </Badge>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!categoriaAberta} onOpenChange={(o) => !o && setCategoriaAberta(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{categoriaAberta}</DialogTitle>
            <DialogDescription>
              O que entra nesta categoria no período escolhido, do maior para o menor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {itensDaCategoria.map((i) => (
              <div key={i.chave} className="rounded-lg border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{i.descricao}</span>
                  <span className="shrink-0 font-semibold">{fmt(i.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {i.meses} mês(es)
                  {i.recorrente
                    ? i.recorrente.mesesSemAparecer >= 2
                      ? ` · parou de aparecer, já economizou ${fmt(i.recorrente.economiaAcumulada)}`
                      : ` · se repete todo mês (${fmt(i.recorrente.valor)}/mês)`
                    : ""}
                </p>
                {i.recorrente && i.recorrente.mesesSemAparecer <= 1 && (
                  <Button size="sm" variant="outline" className="mt-1 h-7 text-[11px]" asChild>
                    <Link to="/despesas" search={{ busca: i.descricao, mes: "todos" } as any}>
                      <Scissors className="mr-1 size-3.5" aria-hidden="true" /> Quero cancelar
                    </Link>
                  </Button>
                )}
              </div>
            ))}
            {!itensDaCategoria.length && (
              <p className="text-sm text-muted-foreground">Nada lançado nesta categoria.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriaAberta(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

/** Retângulo do mapa de categorias: nome, valor e percentual quando couber. */
function CelulaTreemap(props: any) {
  const { x, y, width, height, name, valor, participacao, fill, fmt, onAbrir } = props;
  if (width == null || height == null) return null;
  const cabeNome = width > 64 && height > 28;
  const cabeValor = width > 90 && height > 46;
  return (
    <g
      onClick={() => name && onAbrir?.(name)}
      style={{ cursor: name ? "pointer" : "default" }}
      role={name ? "button" : undefined}
      aria-label={name ? `Ver ${name}` : undefined}
    >
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--background)" strokeWidth={2} rx={6} />
      {cabeNome && (
        <text x={x + 8} y={y + 18} fontSize={11} fontWeight={600} fill="#fff">
          {name}
        </text>
      )}
      {cabeValor && (
        <text x={x + 8} y={y + 34} fontSize={10} fill="#fff" opacity={0.85}>
          {fmt?.(valor ?? 0)} · {Math.round(participacao ?? 0)}%
        </text>
      )}
    </g>
  );
}
