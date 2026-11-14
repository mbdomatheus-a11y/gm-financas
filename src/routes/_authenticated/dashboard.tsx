import { createFileRoute, Link } from "@tanstack/react-router";
import { useContas } from "@/hooks/useContas";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Landmark,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/AppLayout";
import { VisaoGeralHome } from "@/components/VisaoGeralHome";
import { MonthPicker } from "@/components/MonthPicker";
import { ResumoPrevisaoHome } from "@/components/ResumoPrevisaoHome";
import { FluxoDespesas } from "@/components/FluxoDespesas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCotacao } from "@/hooks/useCotacao";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { CartaoCarregando } from "@/components/CartaoCarregando";
import { useCartoes, useCategorias, useDespesas, useFaturasMes, useInvestimentos, useReceitas } from "@/hooks/useFinance";
import { usePreferencias } from "@/hooks/usePreferencias";
import { SobraCiclo } from "@/components/SobraCiclo";
import { useDadosCiclo, useNumerosCiclo } from "@/hooks/useNumerosCiclo";
import { calcularNumerosDosCiclos, despesaNoCiclo, janelasDoCiclo, type NumerosCiclo } from "@/lib/numeros-ciclo";
import { metaDoMes } from "@/lib/poupar";
import { contaComoDespesa, movimentosDeInvestimentos, totaisInvestimentos } from "@/lib/regras-saldo";
import { useEstruturaCategorias } from "@/hooks/useEstruturaCategorias";
import { criarCorPorCategoria, nomeBaseDoGrupo } from "@/lib/categorias-cor";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { lancamentosDoCardMes, somaLancamentosCard, type LancamentoCard } from "@/lib/lancamentos-card";
import { opacidadePorPosicao, posicaoTemporalDoMes } from "@/lib/tempo-visual";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatarResumoValor, valoresOcultosNaArea, formatDate, formatUSD, identificacaoDespesa, monthKey, monthLabel, monthLabelLong, toBRL, competenciaDoDia, mesDoCiclo } from "@/lib/format";
import { nomeDoCiclo, rotuloDoCiclo } from "@/lib/rotulo-ciclo";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { lancamentosPorCompetencias, receitasPorCompetencias, somarMeses } from "@/lib/recorrencia";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Control ALL" },
      {
        name: "description",
        content:
          "Resumo do mês: receitas, despesas, saldo, valor mensalizado das parcelas e dívida total em aberto.",
      },
      { property: "og:title", content: "Dashboard | Control ALL" },
      {
        property: "og:description",
        content: "Resumo financeiro do casal com gráficos de categorias e evolução mensal.",
      },
    ],
  }),
  component: DashboardPage,
});

const PALETA = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.62 0.13 200)",
  "oklch(0.7 0.13 120)",
  "oklch(0.66 0.15 30)",
];

const JANELAS = [
  { value: "m1p1", label: "3 meses (anterior, atual e próximo)" },
  { value: "m1p5", label: "Mês anterior + próximos 5" },
  { value: "-6", label: "Últimos 6 meses" },
  { value: "-12", label: "Últimos 12 meses" },
  { value: "6", label: "Próximos 6 meses" },
  { value: "12", label: "Próximos 12 meses" },
  { value: "24", label: "Próximos 24 meses" },
  { value: "custom", label: "Período personalizado" },
];

/** Gera as chaves de mês da janela escolhida (negativo = passado incluindo o mês atual). */
function monthWindow(janela: string): string[] {
  const n = Number(janela);
  const now = new Date();
  const out: string[] = [];
  // Item 10 (2026-10-05): padrão do site = mês anterior, o atual e os 5 seguintes.
  if (janela === "m1p1") {
    for (let i = -1; i <= 1; i++)
      out.push(mesDoCiclo(+ i));
    return out;
  }
  if (janela === "m1p5") {
    for (let i = -1; i <= 5; i++)
      out.push(mesDoCiclo(+ i));
    return out;
  }
  if (n < 0) {
    for (let i = -n - 1; i >= 0; i--)
      out.push(mesDoCiclo(- i));
  } else {
    for (let i = 0; i < n; i++)
      out.push(mesDoCiclo(+ i));
  }
  return out;
}

/** Gera as chaves de mês entre `inicio` e `fim` (ambos "YYYY-MM", inclusive). */
function monthRange(inicio: string, fim: string): string[] {
  const [yi, mi] = inicio.split("-").map(Number);
  const [yf, mf] = fim.split("-").map(Number);
  if (!yi || !mi || !yf || !mf) return [];
  const out: string[] = [];
  let y = yi;
  let m = mi;
  // Limite de segurança pra nunca gerar uma janela absurdamente grande
  // (ex.: datas trocadas por engano) — 30 anos de meses é mais que suficiente.
  let guarda = 0;
  while ((y < yf || (y === yf && m <= mf)) && guarda < 360) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    guarda++;
  }
  return out;
}

// Item 10 (2026-10-05): rótulos abreviados nos pontos (21837,00 vira 21,8K); o valor
// completo, com centavos, aparece no tooltip ao passar o mouse.
const compact = (v: any) => {
  const n = Number(v);
  if (!n) return "";
  if (valoresOcultosNaArea()) return "••••";
  const a = Math.abs(n);
  const f = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (a >= 1_000_000) return `${f(n / 1_000_000)}M`;
  if (a >= 1_000) return `${f(n / 1_000)}K`;
  return f(n);
};

type Agrupamento = "categoria" | "tipo" | "responsavel";

const AGRUPAMENTOS: { value: Agrupamento; label: string }[] = [
  { value: "categoria", label: "Por categoria" },
  { value: "tipo", label: "Fixa x variável" },
  { value: "responsavel", label: "Por responsável" },
];

function DashboardPage() {
  // 07/11/2026: nome da conta na identificação da despesa.
  const { todas: contasParaNome } = useContas();
  const nomesContasMapa = useMemo(() => new Map(contasParaNome.map((c) => [String(c.id), c.nome])), [contasParaNome]);
  const cotacao = useCotacao();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const financasProntas = useFinancasProntas();
  const { data: faturasMes = [] } = useFaturasMes();
  // 07/11/2026: regras de saldo (Personalização). "Somar pagamento de fatura" desligada tira o pagamento
  // de fatura de todos os totais daqui; "Somar investimentos" ligada põe aportes e resgates no saldo do mês.
  const { prefs } = usePreferencias();
  const somarPagamentoFatura = prefs.somar_pagamento_fatura;
  const { data: investimentos = [] } = useInvestimentos();
  const movimentosInvest = useMemo(
    () => (prefs.somar_investimentos ? movimentosDeInvestimentos(investimentos as any[]) : null),
    [prefs.somar_investimentos, investimentos],
  );
  // Bloco 3 (plano-mega 2026-09-14): cor por categoria vem sempre do
  // cadastro em /categorias, não mais sorteada por posição no gráfico.
  const { data: categoriasDespesa = [] } = useCategorias("despesa");
  const { macroDe: macroDeCategoria } = useEstruturaCategorias("despesa");
  const corPorCategoria = useMemo(
    () => criarCorPorCategoria(categoriasDespesa as any[]),
    [categoriasDespesa],
  );

  // Item 5 (backlog 2026-09-27): "mês do sistema" — se o usuário configurou
  // um dia de virada em Minha Conta, `mesAtual` passa a refletir esse ciclo
  // em vez do mês calendário, em todas as caixas que dependem dele aqui
  // (Receitas/Despesas/Saldo/Parcelas do mês). Sem configuração, comporta-se
  // exatamente como antes (mês calendário normal).
  const mesAtual = useCompetenciaVigente();
  // 07/11/2026: a sobra do topo vem só de numeros-ciclo.ts (mesmos números do Início).
  const numerosCiclo = useNumerosCiclo(mesAtual);
  // 09/11/2026: cards Receitas e Despesas = receitas e despesas do ciclo da mesma função; comparação com o ciclo anterior idem.
  const numerosCicloAnterior = useNumerosCiclo(somarMeses(mesAtual, -1));
  const { dados: dadosCiclo, caixinhas: caixinhasCiclo, diaVirada: diaViradaCiclo } = useDadosCiclo();
  // Item 10 (2026-10-05): a última opção escolhida fica salva neste navegador.
  const [janela, setJanela] = usePersistedState("dashboard.janela2", "m1p1");
  const [mesInicioCustom, setMesInicioCustom] = usePersistedState("dashboard.mesInicioCustom", mesAtual);
  const [mesFimCustom, setMesFimCustom] = usePersistedState("dashboard.mesFimCustom", mesAtual);
  // Item 3 (backlog 2026-09-27): preferências de exibição do gráfico
  // (fluxo/tipo) e do agrupamento lembradas por sessão (localStorage) e
  // restauradas quando o usuário volta pro Dashboard.
  const [visaoFluxo, setVisaoFluxo] = usePersistedState<"ambos" | "receitas" | "despesas">(
    "dashboard.visaoFluxo",
    "ambos",
  );
  const [tipoGrafico, setTipoGrafico] = usePersistedState<"barras" | "linhas">(
    "dashboard.tipoGrafico",
    "barras",
  );
  const [mesPie, setMesPie] = useState(mesAtual);
  const [agrupamento, setAgrupamento] = usePersistedState<Agrupamento>(
    "dashboard.agrupamento",
    "categoria",
  );
  const [drill, setDrill] = useState<{ mes: string; grupo?: string } | null>(null);
  const [editando, setEditando] = useState<any | null>(null);
  // Pedido 2 (2026-10-03): meses do card de alívio de parcelamentos que podem ser expandidos
  const [alivioExpandido, setAlivioExpandido] = useState<Record<string, boolean>>({});
  // Item 2 (2026-10-05): itens marcados para somar na hora, sem calculadora externa.
  const [alivioSel, setAlivioSel] = useState<Set<string>>(new Set());
  function alternarAlivioMes(ids: string[]) {
    setAlivioSel((prev) => {
      const n = new Set(prev);
      const todos = ids.every((i) => n.has(i));
      for (const i of ids) {
        if (todos) n.delete(i);
        else n.add(i);
      }
      return n;
    });
  }
  function alternarAlivioSel(id: string) {
    setAlivioSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Item 10 (backlog 2026-09-27): agrupamentos nascem recolhidos por padrão;
  // a escolha do usuário (expandido/recolhido) é lembrada entre sessões.
  const AGRUPAMENTOS_ABERTO_KEY = "financas_agrupamentos_dashboard_aberto";
  const [agrupamentosAberto, setAgrupamentosAberto] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(AGRUPAMENTOS_ABERTO_KEY) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(AGRUPAMENTOS_ABERTO_KEY, String(agrupamentosAberto));
    } catch {
      // Ignora falhas de localStorage
    }
  }, [agrupamentosAberto]);

  const meses = useMemo(() => {
    if (janela === "custom") {
      const inicio = mesInicioCustom <= mesFimCustom ? mesInicioCustom : mesFimCustom;
      const fim = mesInicioCustom <= mesFimCustom ? mesFimCustom : mesInicioCustom;
      return monthRange(inicio, fim);
    }
    return monthWindow(JANELAS.some((j) => j.value === janela) ? janela : "m1p1");
  }, [janela, mesInicioCustom, mesFimCustom]);

  // Janela usada para calcular parcelas/lançamentos por competência — cobre
  // sempre pelo menos -12..+24 meses (padrão), mas se o período personalizado
  // escolhido for maior que isso, amplia para cobrir o intervalo escolhido.
  const mesesSelecionaveis = useMemo(() => {
    const now = new Date();
    const base: string[] = [];
    for (let i = -12; i <= 24; i++)
      base.push(mesDoCiclo(+ i));
    if (meses.length === 0) return base;
    const uniao = new Set([...base, ...meses]);
    return Array.from(uniao).sort();
  }, [meses]);

  const parcelas = useMemo(
    () =>
      aplicarRegrasFaturaMes(
        lancamentosPorCompetencias(despesas as any[], mesesSelecionaveis),
        faturasMes as any[],
      ).filter((p: any) => contaComoDespesa(p.despesa, somarPagamentoFatura)),
    [despesas, mesesSelecionaveis, faturasMes, somarPagamentoFatura],
  );

  const receitasProjetadas = useMemo(
    () => receitasPorCompetencias(receitas as any[], mesesSelecionaveis),
    [receitas, mesesSelecionaveis],
  );

  const grupoDe = useMemo(
    () => (p: any) =>
      agrupamento === "categoria"
        ? macroDeCategoria(p.despesa.categoria)
        : agrupamento === "tipo"
          ? p.despesa.tipo === "fixa"
            ? "Fixa"
            : "Variável"
          : (p.despesa.responsavel ?? "Sem responsável"),
    [agrupamento, macroDeCategoria],
  );

  const { data: cartoesCiclo = [] } = useCartoes();
  const lancamentosAbertoMes = useMemo(
    () => lancamentosDoCardMes(despesas as any[], faturasMes as any[], mesAtual, "aberto", cotacao, somarPagamentoFatura, cartoesCiclo as any[]),
    [despesas, faturasMes, mesAtual, cotacao, somarPagamentoFatura, cartoesCiclo],
  );

  const dados = useMemo(() => {
    const receitasMes = receitasProjetadas.filter((r) => r.competencia === mesAtual);
    const totalReceitas = receitasMes.reduce(
      (s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao),
      0,
    );
    const usdReceitas = receitasMes
      .filter((r: any) => r.moeda === "USD")
      .reduce((s: number, r: any) => s + Number(r.valor), 0);

    // 09/11/2026: mesmas janelas do ciclo (faturas pelo mês de fechamento, contas pelo vencimento de D+1 a D).
    const janelaMes = janelasDoCiclo(mesAtual, diaViradaCiclo);
    const parcelasMes = parcelas.filter((p: any) => despesaNoCiclo(p, janelaMes, cartoesCiclo as any[]));
    const totalDespesas = parcelasMes.reduce(
      (s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      0,
    );
    const usdDespesas = parcelasMes
      .filter((p: any) => p.despesa.moeda === "USD")
      .reduce((s: number, p: any) => s + Number(p.valor), 0);

    const fixas = parcelasMes
      .filter((p: any) => p.despesa.tipo === "fixa")
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);
    // Parcelados (parcelas de compras/faturas) são compromissos contratados:
    // ficam fora da base variável do forecast, assim como as fixas.
    const parcelados = parcelasMes
      .filter((p: any) => p.despesa.tipo !== "fixa" && p.despesa.total_parcelas > 1)
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);
    const variaveis = totalDespesas - fixas;
    const variaveisPuras = Math.max(0, variaveis - parcelados);

    const mensalizado = parcelasMes
      .filter((p: any) => p.despesa.tipo !== "fixa" && p.despesa.total_parcelas > 1)
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);


    const porCategoria = new Map<string, number>();
    for (const p of parcelas.filter((p: any) => competenciaDoDia(p.vencimento) === mesPie)) {
      // Uma fatia por categoria mãe (fixa e variável somadas).
      const key = soMacro(macroDeCategoria(p.despesa.categoria));
      porCategoria.set(
        key,
        (porCategoria.get(key) ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      );
    }

    // Grupos com maior peso na janela, para as barras empilhadas.
    const pesoGrupo = new Map<string, number>();
    for (const p of parcelas) {
      if (!meses.includes(competenciaDoDia(p.vencimento))) continue;
      const g = grupoDe(p);
      pesoGrupo.set(g, (pesoGrupo.get(g) ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao));
    }
    const grupos = Array.from(pesoGrupo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([g]) => g);

    const previstoMeses = calcularNumerosDosCiclos(dadosCiclo, meses, (m) => metaDoMes(caixinhasCiclo, m), diaViradaCiclo);
    const serie = meses.map((key: string) => {
      const rec = receitasProjetadas
        .filter((r) => r.competencia === key)
        .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
      const linha: any = { mes: monthLabel(key), key, Receitas: Number(rec.toFixed(2)) };
      let des = 0;
      for (const g of grupos) linha[g] = 0;
      linha["Outros grupos"] = 0;
      for (const p of parcelas.filter((p: any) => competenciaDoDia(p.vencimento) === key)) {
        const v = toBRL(Number(p.valor), p.despesa.moeda, cotacao);
        des += v;
        const g = grupoDe(p);
        const alvo = grupos.includes(g) ? g : "Outros grupos";
        linha[alvo] = Number((linha[alvo] + v).toFixed(2));
      }
      linha.Despesas = Number(des.toFixed(2));
      // 07/11/2026: o saldo do mês é o previsto no fim do ciclo (numeros-ciclo.ts).
      linha.Saldo = previstoMeses.get(key)?.previsto.sobra ?? 0;
      return linha;
    });
    const temOutros = serie.some((l: any) => l["Outros grupos"] > 0);
    const gruposFinais = temOutros ? [...grupos, "Outros grupos"] : grupos;

    const parceladas = despesas
      .filter((d: any) => d.tipo !== "fixa" && d.total_parcelas > 1)
      .map((d: any) => ({
        id: d.id,
        descricao: d.descricao,
        cartao: identificacaoDespesa(d, nomesContasMapa) || "Sem forma de pagamento",
        pagas: (d.parcelas ?? []).filter((p: any) => p.paga).length,
        total: d.total_parcelas,
        valorParcela: toBRL(
          Number(d.valor_parcela ?? (d.parcelas ?? [])[0]?.valor ?? d.valor ?? 0),
          d.moeda,
          cotacao,
        ),
        restante: (d.parcelas ?? [])
          .filter((p: any) => !p.paga)
          .reduce((s: number, p: any) => s + toBRL(Number(p.valor ?? 0), d.moeda, cotacao), 0),
      }))
      .filter((d: any) => d.pagas < d.total)
      .slice(0, 6);

    const top5 = parcelasMes
      .map((p: any) => ({
        id: p.id,
        descricao: p.despesa.descricao,
        identificacao: identificacaoDespesa(p.despesa, nomesContasMapa),
        valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    const mediaDespesas =
      serie.length > 0 ? serie.reduce((s, l: any) => s + l.Despesas, 0) / serie.length : 0;

    // Mês anterior, para variação percentual nos indicadores.
    const ref = new Date(`${mesAtual}-01T12:00:00`);
    const mesAnterior = mesDoCiclo(- 1);
    const receitasAnt = receitasProjetadas
      .filter((r) => r.competencia === mesAnterior)
      .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
    const despesasAnt = parcelas
      .filter((p: any) => competenciaDoDia(p.vencimento) === mesAnterior)
      .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);

    // Uso por cartão no mês corrente.
    const cartaoMap = new Map<
      string,
      { id: string | null; nome: string; cor: string; valor: number }
    >();
    for (const p of parcelasMes) {
      const d = p.despesa;
      const id = d.cartao_id ?? null;
      const nome = d.cartoes
        ? `${d.cartoes.apelido || "Cartão"} •${d.cartoes.final ?? ""} · ${d.cartoes.titular?.trim().split(/\s+/)[0] || "Titular não informado"}`
        : (d.bancos?.nome ?? d.banco_nome ?? "Sem cartão");
      const key = id ?? nome;
      const item = cartaoMap.get(key) ?? {
        id,
        nome,
        cor: d.cartoes?.cor ?? "var(--muted-foreground)",
        valor: 0,
      };
      item.valor += toBRL(Number(p.valor), d.moeda, cotacao);
      cartaoMap.set(key, item);
    }
    const porCartao = Array.from(cartaoMap.values()).sort((a, b) => b.valor - a.valor);

    // Gasto por responsável no mês.
    const respMap = new Map<string, number>();
    for (const p of parcelasMes) {
      const r = p.despesa.responsavel ?? "Sem responsável";
      respMap.set(r, (respMap.get(r) ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao));
    }
    const porResponsavel = Array.from(respMap, ([nome, valor]) => ({
      nome,
      valor: Number(valor.toFixed(2)),
    })).sort((a, b) => b.valor - a.valor);

    // Categoria: mês atual x média dos 3 meses anteriores.
    const tresMeses = [1, 2, 3].map((i) =>
      mesDoCiclo(- i),
    );
    const atualCat = new Map<string, number>();
    const mediaCat = new Map<string, number>();
    for (const p of parcelas) {
      const mk = competenciaDoDia(p.vencimento);
      const cat = soMacro(macroDeCategoria(p.despesa.categoria));
      const v = toBRL(Number(p.valor), p.despesa.moeda, cotacao);
      if (mk === mesAtual) atualCat.set(cat, (atualCat.get(cat) ?? 0) + v);
      else if (tresMeses.includes(mk)) mediaCat.set(cat, (mediaCat.get(cat) ?? 0) + v / 3);
    }
    const comparativo = Array.from(new Set([...atualCat.keys(), ...mediaCat.keys()]))
      .map((cat) => ({
        categoria: cat,
        "Mês atual": Number((atualCat.get(cat) ?? 0).toFixed(2)),
        "Média 3 meses": Number((mediaCat.get(cat) ?? 0).toFixed(2)),
      }))
      .sort((a, b) => b["Mês atual"] - a["Mês atual"])
      .slice(0, 6);

    // Próximos vencimentos (30 dias).
    const hoje = new Date();
    const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30);
    const proximos = parcelas
      .filter((p: any) => {
        if (p.paga) return false;
        const v = new Date(`${p.vencimento}T12:00:00`);
        return v >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) && v <= limite;
      })
      .map((p: any) => ({
        id: p.id,
        descricao: p.despesa.descricao,
        identificacao: identificacaoDespesa(p.despesa, nomesContasMapa),
        vencimento: p.vencimento,
        parcela: p.despesa.tipo === "fixa" ? "competência mensal" : `${p.numero}/${p.total}`,
        valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      }))
      .sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 8);

    // Pedido 2 (2026-10-03): Parcelamentos que terminam — agrupado por mês da ÚLTIMA parcela
    // do contrato (numero === total), mostrando quanto cada despesa "libera" no orçamento.
    // Regras:
    //   1. Apenas despesas variáveis parceladas (não fixa, não fatura manual de cartão).
    //   2. Uma despesa SÓ aparece se sua parcela final (numero === total) ainda não foi paga.
    //      Parcelas intermediárias (ex. 9/10) não indicam término — só a 10/10 indica.
    //   3. Faturas manuais de cartão (origem = "fatura_total_concluida") são lançamentos
    //      avulsos mensais e NÃO têm prazo de término — devem ser ignoradas.
    const alivioMap = new Map<
      string,
      { mes: string; total: number; itens: { id: string; descricao: string; cartao: string; valor: number; ultimaParcela: string; numeroParcela: string }[] }
    >();
    for (const d of despesas as any[]) {
      // Exclui: fixas, sem parcelas, e faturas manuais de cartão (lançamentos sem prazo definido)
      if (d.tipo === "fixa" || !d.parcelas?.length) continue;
      if (d.origem === "fatura_total_concluida") continue;

      const parcelasD: any[] = d.parcelas;
      // Identifica o total real de parcelas: usa o maior `total` nas rows de parcela,
      // com fallback em `d.total_parcelas`
      const totalParcelas = parcelasD.reduce(
        (mx: number, p: any) => Math.max(mx, Number(p.total) || 0),
        0,
      ) || Number(d.total_parcelas) || 0;

      if (totalParcelas <= 1) continue; // à vista, não é parcelamento que "termina"

      // A parcela que ENCERRA o contrato é aquela com numero === totalParcelas
      const parcelaFinal = parcelasD.find(
        (p: any) => Number(p.numero) === totalParcelas,
      );

      // Só considera se a parcela final existe e ainda não foi paga
      if (!parcelaFinal || parcelaFinal.paga) continue;

      const mesFim = competenciaDoDia(parcelaFinal.vencimento);
      const valorParcela = toBRL(Number(parcelaFinal.valor ?? d.valor_parcela ?? d.valor), d.moeda, cotacao);

      if (!alivioMap.has(mesFim)) {
        alivioMap.set(mesFim, { mes: mesFim, total: 0, itens: [] });
      }
      const entry = alivioMap.get(mesFim)!;
      entry.total = Number((entry.total + valorParcela).toFixed(2));
      entry.itens.push({
        id: d.id,
        descricao: d.descricao,
        cartao: identificacaoDespesa(d, nomesContasMapa) || "Sem forma de pagamento",
        valor: valorParcela,
        ultimaParcela: parcelaFinal.vencimento,
        numeroParcela: `${totalParcelas}/${totalParcelas}`,
      });
    }
    // Só meses futuros (a partir do mês atual) ordenados
    const now2 = mesAtual;
    const alivioParcelamentos = Array.from(alivioMap.values())
      .filter((g) => g.mes >= now2)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(0, 18); // máximo 18 meses à frente

    // Regra "Somar investimentos": resgate entra nas receitas e aporte nas despesas do mês (e do anterior, para a variação).
    const doMes = (key: string) => (data: string) => competenciaDoDia(data) === key;
    const inv = movimentosInvest ? totaisInvestimentos(movimentosInvest, doMes(mesAtual)) : { entradas: 0, saidas: 0 };
    const invAnt = movimentosInvest ? totaisInvestimentos(movimentosInvest, doMes(mesAnterior)) : { entradas: 0, saidas: 0 };
    const recTotal = totalReceitas + inv.entradas;
    const desTotal = totalDespesas + inv.saidas;
    const recAntTotal = receitasAnt + invAnt.entradas;
    const desAntTotal = despesasAnt + invAnt.saidas;

    return {
      totalReceitas: recTotal,
      totalDespesas: desTotal,
      usdReceitas,
      usdDespesas,
      saldo: recTotal - desTotal,
      taxaPoupanca: recTotal > 0 ? ((recTotal - desTotal) / recTotal) * 100 : 0,
      fixas,
      variaveis,
      parcelados,
      variaveisPuras,
      mensalizado,
      mediaDespesas,
      deltaReceitas: recAntTotal > 0 ? ((recTotal - recAntTotal) / recAntTotal) * 100 : null,
      deltaDespesas: desAntTotal > 0 ? ((desTotal - desAntTotal) / desAntTotal) * 100 : null,
      porCartao,
      porResponsavel,
      comparativo,
      proximos,
      totalProximos: proximos.reduce((s: number, p: any) => s + p.valor, 0),
      pie: Array.from(porCategoria, ([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
      meses: serie,
      grupos: gruposFinais,
      parceladas,
      top5,
      alivioParcelamentos,
    };
  }, [receitasProjetadas, despesas, parcelas, cotacao, mesAtual, mesPie, meses, grupoDe, macroDeCategoria, movimentosInvest, dadosCiclo, caixinhasCiclo, diaViradaCiclo, cartoesCiclo]);

  // Pedido 3 (2026-10-03): O último mês do gráfico comanda o horizonte padrão da dívida
  const mesAtualRotulo = useMemo(
    () => (dados.meses as any[]).find((m) => m.key === mesAtual)?.mes as string | undefined,
    [dados.meses, mesAtual],
  );

  const mesFimGrafico = useMemo(() => {
    return meses[meses.length - 1] ?? mesAtual;
  }, [meses, mesAtual]);

  // Pedido 3 (2026-10-03): Alívio de parcelas que terminam no período selecionado no gráfico
  const alivioPeriodo = useMemo(() => {
    const gruposNoPeriodo = dados.alivioParcelamentos.filter(
      (g) => g.mes === mesAtual,
    );
    const totalAlivio = gruposNoPeriodo.reduce((s, g) => s + g.total, 0);
    const qtdContratos = gruposNoPeriodo.reduce((s, g) => s + g.itens.length, 0);
    return {
      totalAlivio,
      qtdContratos,
      grupos: gruposNoPeriodo,
    };
  }, [dados.alivioParcelamentos, meses, mesAtual, mesFimGrafico]);

  const detalhe = useMemo(() => {
    if (!drill) return [];
    return parcelas
      .filter((p: any) => competenciaDoDia(p.vencimento) === drill.mes)
      .filter((p: any) => {
        if (!drill.grupo) return true;
        const g = grupoDe(p);
        return drill.grupo === "Outros grupos" ? !dados.grupos.includes(g) : g === drill.grupo;
      })
      .map((p: any) => ({
        id: p.id,
        despesa: p.despesa,
        descricao: p.despesa.descricao,
        identificacao: identificacaoDespesa(p.despesa, nomesContasMapa),
        parcela: p.despesa.tipo === "fixa" ? "competência mensal" : `${p.numero}/${p.total}`,
        vencimento: p.vencimento,
        paga: p.paga,
        valor: toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      }))

      .sort((a: any, b: any) => b.valor - a.valor);
  }, [drill, parcelas, grupoDe, dados.grupos, cotacao]);

  /** Agrupamentos do mês selecionado, do maior para o menor. */
  const agrupamentosMes = useMemo(() => {
    const map = new Map<string, { total: number; itens: number }>();
    for (const p of parcelas.filter((p: any) => competenciaDoDia(p.vencimento) === mesPie)) {
      const g = grupoDe(p);
      const atual = map.get(g) ?? { total: 0, itens: 0 };
      atual.total += toBRL(Number(p.valor), p.despesa.moeda, cotacao);
      atual.itens += 1;
      map.set(g, atual);
    }
    const lista = Array.from(map, ([grupo, v]) => ({ grupo, ...v })).sort(
      (a, b) => b.total - a.total,
    );
    const total = lista.reduce((s, g) => s + g.total, 0);
    return { lista, total };
  }, [parcelas, grupoDe, mesPie, cotacao]);

  // Só faz sentido usar a cor cadastrada da categoria quando o agrupamento
  // atual é "por categoria" — em "fixa x variável"/"por responsável" o
  // grupo não é uma categoria de verdade, então cai no fallback por hash
  // (determinístico, mas sem relação com /categorias).
  const corGrupo = (g: string) =>
    agrupamento === "categoria" ? corPorCategoria(g) : corPorCategoria(`__grupo__${g}`);

  const { formatarResumo: fmtGlobal } = usePrivacidadeValores();

  return (
    <AppLayout
      title="Finanças"
      description={`Resumo do ${rotuloDoCiclo(mesAtual).replace("Ciclo", "ciclo")} · USD ${cotacao.toFixed(2)}`}
      actions={
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link to="/relatorios">Ver em Relatórios</Link>
        </Button>
      }
    >
      {!financasProntas ? (
        <CartaoCarregando alturaGrafico="h-24" />
      ) : (
      <HeroMes
        numeros={numerosCiclo}
        receitas={numerosCiclo.previsto.receitas}
        despesas={numerosCiclo.previsto.despesas}
        deltaReceitas={variacaoPct(numerosCiclo.previsto.receitas, numerosCicloAnterior.previsto.receitas)}
        deltaDespesas={variacaoPct(numerosCiclo.previsto.despesas, numerosCicloAnterior.previsto.despesas)}
        fixas={dados.fixas}
        variaveis={dados.variaveis}
        mesRotulo={rotuloDoCiclo(mesAtual)}
      />
      )}
      <div className="mt-4">
        <VisaoGeralHome parte="mes" />
      </div>
      {!financasProntas ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy="true">
          <CartaoCarregando className="mb-0" alturaGrafico="h-8" />
          <CartaoCarregando className="mb-0" alturaGrafico="h-8" />
          <CartaoCarregando className="mb-0" alturaGrafico="h-8" />
        </div>
      ) : (
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Parcelas do mês (fixas + variáveis)"
          value={dados.fixas + dados.variaveis}
          icon={CalendarClock}
          tone="warning"
          hint={`Fixas ${fmtGlobal(dados.fixas)} · Variáveis ${fmtGlobal(dados.variaveis)}`}
          to="/despesas"
          search={{ filtro: "parcelas", mes: mesAtual }}
        />
        <DividaEmAbertoCard itens={lancamentosAbertoMes} mes={mesAtual} />
        <StatCard
          label="Parcelas que terminam"
          value={alivioPeriodo.totalAlivio}
          icon={CheckCircle2}
          tone="success"
          hint={
            alivioPeriodo.qtdContratos > 0
              ? `${alivioPeriodo.qtdContratos} ${alivioPeriodo.qtdContratos === 1 ? "parcelamento encerra" : "parcelamentos encerram"} no ${nomeDoCiclo(mesAtual).toLowerCase()}`
              : `Nenhum término no ${nomeDoCiclo(mesAtual).toLowerCase()}`
          }
          display={
            alivioPeriodo.totalAlivio > 0
              ? `+${fmtGlobal(alivioPeriodo.totalAlivio)}/mês`
              : fmtGlobal(0)
          }
          href="#parcelamentos-terminando"
        />
      </div>
      )}
      <div className="mt-6">
      <FluxoDespesas />
      </div>
      {/* 27/10/2026: mesmo cartão "Previsão do mês" do app e do Início (lib/previsao-mes.ts). */}
      <ResumoPrevisaoHome mes={mesAtual} className="mt-6 overflow-hidden" />

      <Card id="fluxo-caixa" className="mt-6">
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Fluxo de caixa mês a mês</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={visaoFluxo} onValueChange={(v) => setVisaoFluxo(v as typeof visaoFluxo)}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Receitas e despesas</SelectItem>
                <SelectItem value="receitas">Somente receitas</SelectItem>
                <SelectItem value="despesas">Somente despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={tipoGrafico}
              onValueChange={(v) => setTipoGrafico(v as typeof tipoGrafico)}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barras">Barras</SelectItem>
                <SelectItem value="linhas">Linhas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGRUPAMENTOS.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={janela} onValueChange={setJanela}>
              <SelectTrigger className="h-8 w-[230px] text-xs" aria-label="Quantos meses ver">
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
            {janela === "custom" && (
              <div className="flex items-center gap-1.5">
                <MonthPicker
                  value={mesInicioCustom}
                  onChange={setMesInicioCustom}
                  ariaLabel="Mês inicial"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <MonthPicker
                  value={mesFimCustom}
                  onChange={setMesFimCustom}
                  ariaLabel="Mês final"
                />
              </div>
            )}
          </div>
        </CardHeader>
        {dados.meses.some((m: any) => posicaoTemporalDoMes(m.key, mesAtual) === "futuro") && (
          <p className="px-6 pb-1 text-xs text-muted-foreground">
            Meses futuros aparecem mais claros: são previsões.
          </p>
        )}
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            {tipoGrafico === "linhas" ? (
              <LineChart data={dados.meses} margin={{ top: 28, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} domain={[(m: number) => Math.min(0, m), (m: number) => Math.ceil(Math.max(0, m) * 1.15)]} />
                <Tooltip formatter={(v: any, n: any) => [formatarResumoValor(Number(v)), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {mesAtualRotulo && (
                  <ReferenceArea
                    x1={mesAtualRotulo}
                    x2={mesAtualRotulo}
                    fill="var(--primary)"
                    fillOpacity={0.1}
                    stroke="var(--primary)"
                    strokeOpacity={0.4}
                    label={{ value: "atual", position: "insideTop", fontSize: 9, fill: "var(--primary)" }}
                  />
                )}
                {visaoFluxo !== "despesas" && (
                  <Line isAnimationActive={false}
                    type="monotone"
                    dataKey="Receitas"
                    stroke="var(--success)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  >
                    {dados.meses.length <= 12 && (
                      <LabelList dataKey="Receitas" position="top" fontSize={9} formatter={compact} />
                    )}
                  </Line>
                )}
                {visaoFluxo !== "receitas" && (
                  <Line isAnimationActive={false}
                    type="monotone"
                    dataKey="Despesas"
                    stroke="var(--destructive)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  >
                    {dados.meses.length <= 12 && (
                      <LabelList dataKey="Despesas" position="top" fontSize={9} formatter={compact} />
                    )}
                  </Line>
                )}
                <Line isAnimationActive={false}
                  type="monotone"
                  dataKey="Saldo"
                  name="Saldo Líquido (Receita - Despesa)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                >
                  {dados.meses.length <= 12 && (
                    <LabelList dataKey="Saldo" position="bottom" fontSize={9} formatter={compact} />
                  )}
                </Line>
              </LineChart>
            ) : (
              <BarChart data={dados.meses} margin={{ top: 28, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="mes"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={dados.meses.length > 8 ? -35 : 0}
                  textAnchor={dados.meses.length > 8 ? "end" : "middle"}
                  height={dados.meses.length > 8 ? 46 : 24}
                />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} domain={[(m: number) => Math.min(0, m), (m: number) => Math.ceil(Math.max(0, m) * 1.15)]} />
                <Tooltip
                  formatter={(v: any, n: any) => [formatarResumoValor(Number(v)), n]}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {mesAtualRotulo && (
                  <ReferenceArea
                    x1={mesAtualRotulo}
                    x2={mesAtualRotulo}
                    fill="var(--primary)"
                    fillOpacity={0.1}
                    stroke="var(--primary)"
                    strokeOpacity={0.4}
                    label={{ value: "atual", position: "insideTop", fontSize: 9, fill: "var(--primary)" }}
                  />
                )}
                {visaoFluxo !== "despesas" && (
                  <Bar maxBarSize={44} isAnimationActive={false} dataKey="Receitas" fill="var(--success)" radius={[6, 6, 0, 0]}>
                    {/* Bloco 3 (plano-mega 2026-09-14): mês além do atual vem com
                        opacidade reduzida — ainda é previsão, não aconteceu. */}
                    {dados.meses.map((m: any, i: number) => (
                      <Cell
                        key={m.key}
                        fillOpacity={opacidadePorPosicao(posicaoTemporalDoMes(m.key, mesAtual))}
                      />
                    ))}
                    {dados.meses.length <= 12 && (
                      <LabelList
                        dataKey="Receitas"
                        position="top"
                        fontSize={9}
                        formatter={compact}
                      />
                    )}
                  </Bar>
                )}
                {visaoFluxo !== "receitas" &&
                  (visaoFluxo === "despesas" ? (
                    <Bar maxBarSize={44} isAnimationActive={false} dataKey="Despesas" fill="var(--destructive)" radius={[6, 6, 0, 0]}>
                      {dados.meses.map((m: any, i: number) => (
                        <Cell
                          key={m.key}
                          fillOpacity={opacidadePorPosicao(posicaoTemporalDoMes(m.key, mesAtual))}
                        />
                      ))}
                      <LabelList
                        dataKey="Despesas"
                        position="top"
                        fontSize={9}
                        formatter={compact}
                      />
                    </Bar>
                  ) : (
                    dados.grupos.map((g, i) => (
                      <Bar
                        key={g}
                        dataKey={g}
                        stackId="despesas"
                        fill={corGrupo(g)}
                        className="cursor-pointer"
                        radius={
                          i === dados.grupos.length - 1
                            ? ([6, 6, 0, 0] as [number, number, number, number])
                            : 0
                        }
                        onClick={(e: any) => setDrill({ mes: e?.payload?.key, grupo: g })}
                      >
                        {dados.meses.map((m: any) => (
                          <Cell
                            key={m.key}
                            fillOpacity={opacidadePorPosicao(posicaoTemporalDoMes(m.key, mesAtual))}
                          />
                        ))}
                      </Bar>
                    ))
                  ))}
                {visaoFluxo === "ambos" && dados.meses.length <= 12 && dados.grupos.length > 0 && (
                  <Bar maxBarSize={44} isAnimationActive={false} dataKey="Despesas" fill="transparent" stackId="rotulo" legendType="none">
                    <LabelList dataKey="Despesas" position="top" fontSize={9} formatter={compact} />
                  </Bar>
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pedido 2 (2026-10-03): Parcelamentos que terminam — alívio mensal */}
      {dados.alivioParcelamentos.length > 0 && (
        <Card id="parcelamentos-terminando" className="mt-6">
          <CardHeader className="space-y-0 pb-3">
            <CardTitle className="text-base">Parcelamentos que terminam</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Quanto cada mês libera no orçamento. Toque para detalhar e marque itens para somar.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {alivioSel.size > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
                <span>
                  {alivioSel.size} selecionado(s):{" "}
                  <strong className="tabular-nums text-success">
                    +
                    {formatarResumoValor(
                      dados.alivioParcelamentos
                        .flatMap((g) => g.itens)
                        .filter((it) => alivioSel.has(it.id))
                        .reduce((t, it) => t + it.valor, 0),
                    )}
                    /mês
                  </strong>
                </span>
                <button
                  type="button"
                  className="text-xs underline text-muted-foreground"
                  onClick={() => setAlivioSel(new Set())}
                >
                  Limpar
                </button>
              </div>
            )}
            {dados.alivioParcelamentos.map((g) => {
              const expandido = alivioExpandido[g.mes] ?? false;
              return (
                <div key={g.mes} className="rounded-lg border overflow-hidden">
                  <div className="flex items-center pl-4 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-[var(--color-primary,#2563eb)]"
                      checked={g.itens.length > 0 && g.itens.every((it) => alivioSel.has(it.id))}
                      onChange={() => alternarAlivioMes(g.itens.map((it) => it.id))}
                      aria-label={`Selecionar todos de ${monthLabelLong(g.mes)}`}
                      title="Selecionar tudo deste mês"
                    />
                  <button
                    type="button"
                    onClick={() => setAlivioExpandido((prev) => ({ ...prev, [g.mes]: !expandido }))}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${expandido ? "" : "-rotate-90"}`}
                    />
                    <span className="flex-1 text-sm font-semibold">{monthLabelLong(g.mes)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {g.itens.length} parcela{g.itens.length > 1 ? "s" : ""}
                    </Badge>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-success">
                      +{formatarResumoValor(g.total)}/mês
                    </span>
                  </button>
                  </div>
                  {expandido && (
                    <div className="divide-y border-t">
                      {g.itens.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 shrink-0 accent-[var(--color-primary,#2563eb)]"
                            checked={alivioSel.has(item.id)}
                            onChange={() => alternarAlivioSel(item.id)}
                            aria-label={`Somar ${item.descricao}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.descricao}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.cartao} · parcela {item.numeroParcela} · vence em {formatDate(item.ultimaParcela)}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-success">
                            +{formatarResumoValor(item.valor)}/mês
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <Collapsible open={agrupamentosAberto} onOpenChange={setAgrupamentosAberto}>
          <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 text-left">
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${agrupamentosAberto ? "rotate-0" : "-rotate-90"}`}
                />
                <CardTitle className="text-base">
                  Agrupamentos de {monthLabelLong(mesPie)}
                </CardTitle>
              </button>
            </CollapsibleTrigger>
            <Select value={mesPie} onValueChange={setMesPie}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mesesSelecionaveis.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-2">
              {agrupamentosMes.lista.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>
              )}
              {agrupamentosMes.lista.map((g) => {
                const pct = agrupamentosMes.total ? (g.total / agrupamentosMes.total) * 100 : 0;
                return (
                  <button
                    key={g.grupo}
                    type="button"
                    onClick={() => setDrill({ mes: mesPie, grupo: g.grupo })}
                    className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium capitalize">{g.grupo}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatarResumoValor(g.total)}</span>
                    </div>
                    <Progress value={pct} className="mt-1.5 h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {g.itens} lançamento(s) · {pct.toFixed(1)}% do mês
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {drill && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {monthLabelLong(drill.mes)}
              {drill.grupo ? ` · ${drill.grupo}` : ""}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setDrill(null)} aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {detalhe.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem lançamentos aqui.</p>
            )}
            {detalhe.map((d: any) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setEditando(d.despesa)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.descricao}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[d.identificacao, d.parcela, formatDate(d.vencimento)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={d.paga ? "secondary" : "outline"}>
                    {d.paga ? "paga" : "em aberto"}
                  </Badge>
                  <span className="font-semibold tabular-nums">{formatarResumoValor(d.valor)}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
            <Select value={mesPie} onValueChange={setMesPie}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mesesSelecionaveis.map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {monthLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            {dados.pie.length === 0 ? (
              <EmptyChart />
            ) : (
              <RankingCategorias
                itens={dados.pie}
                cor={(n) => corPorCategoria(nomeBaseDoGrupo(n))}
                onAbrir={() => setDrill({ mes: mesPie })}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do saldo</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.meses} margin={{ top: 28, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} domain={[(m: number) => Math.min(0, m), (m: number) => Math.ceil(Math.max(0, m) * 1.15)]} />
                <Tooltip formatter={(v: any) => formatarResumoValor(Number(v))} />
                {mesAtualRotulo && (
                  <ReferenceArea
                    x1={mesAtualRotulo}
                    x2={mesAtualRotulo}
                    fill="var(--primary)"
                    fillOpacity={0.1}
                    stroke="var(--primary)"
                    strokeOpacity={0.4}
                    label={{ value: "atual", position: "insideTop", fontSize: 9, fill: "var(--primary)" }}
                  />
                )}
                <Line isAnimationActive={false}
                  type="monotone"
                  dataKey="Saldo"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                >
                  {dados.meses.length <= 12 && (
                    <LabelList dataKey="Saldo" position="top" fontSize={9} formatter={compact} />
                  )}
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maiores despesas do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {dados.top5.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem lançamentos neste mês.</p>
            )}
            {dados.top5.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.descricao}</p>
                  {t.identificacao && (
                    <p className="truncate text-xs text-muted-foreground">{t.identificacao}</p>
                  )}
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatarResumoValor(t.valor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parcelamentos em andamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dados.parceladas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum parcelamento ativo.</p>
            )}
            {dados.parceladas.map((p: any) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{p.descricao}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatarResumoValor(p.valorParcela)}
                    <span className="text-xs font-normal text-muted-foreground">/parcela</span>
                  </span>
                </div>
                <Progress value={(p.pagas / p.total) * 100} className="h-2" />
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{p.cartao}</span>
                  <span className="shrink-0">
                    {p.pagas} de {p.total} pagas · restam {formatarResumoValor(p.restante)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gasto por cartão neste mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dados.porCartao.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem lançamentos neste mês.</p>
            )}
            {dados.porCartao.map((c) => {
              const pct = dados.totalDespesas > 0 ? (c.valor / dados.totalDespesas) * 100 : 0;
              const conteudo = (
                <div className="space-y-1.5 rounded-lg border p-3 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.cor }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nome}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {formatarResumoValor(c.valor)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {pct.toFixed(0)}% das despesas do mês
                  </p>
                </div>
              );
              return c.id ? (
                <Link key={c.id} to="/despesas" search={{ cartao: c.id }} className="block">
                  {conteudo}
                </Link>
              ) : (
                <div key={c.nome}>{conteudo}</div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quem gastou no mês</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dados.porResponsavel.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.porResponsavel}
                  layout="vertical"
                  margin={{ left: 8, right: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={110}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => formatarResumoValor(Number(v))}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Bar maxBarSize={44} isAnimationActive={false} dataKey="valor" radius={[0, 6, 6, 0]}>
                    {dados.porResponsavel.map((_, i) => (
                      <Cell key={i} fill={PALETA[i % PALETA.length]} />
                    ))}
                    <LabelList dataKey="valor" position="right" fontSize={10} formatter={compact} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias: mês atual x média de 3 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dados.comparativo.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.comparativo} margin={{ top: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="categoria"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={56}
                    tickFormatter={(v: any) => (String(v).length > 13 ? `${String(v).slice(0, 12)}…` : String(v))}
                  />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} domain={[(m: number) => Math.min(0, m), (m: number) => Math.ceil(Math.max(0, m) * 1.15)]} />
                  <Tooltip
                    formatter={(v: any, n: any) => [formatarResumoValor(Number(v)), n]}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12 }} />
                  <Bar maxBarSize={44} isAnimationActive={false} dataKey="Mês atual" fill="var(--primary)" radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="Mês atual"
                      position="top"
                      fontSize={9}
                      formatter={compact}
                    />
                  </Bar>
                  <Bar
                    dataKey="Média 3 meses"
                    fill="var(--muted-foreground)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Próximos 30 dias</CardTitle>
            <Badge variant="secondary">{formatarResumoValor(dados.totalProximos)}</Badge>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {dados.proximos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nada a vencer nos próximos 30 dias.</p>
            )}
            {dados.proximos.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.descricao}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.identificacao, p.parcela, formatDate(p.vencimento)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatarResumoValor(p.valor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <EditarDespesaDialog despesa={editando} onClose={() => setEditando(null)} />
    </AppLayout>
  );
}

/** Só a categoria mãe: "Pets - Pet Shop" e "Compras / Varejo" viram "Pets" e "Compras". */
function soMacro(nome: string): string {
  const base = String(nome ?? "").split(/\s+[-/]\s+/)[0]?.trim();
  return base || String(nome ?? "");
}

/** Ranking didático das despesas por categoria mãe: top 7 mais "Outras" com barra e percentual. */
function RankingCategorias({
  itens,
  cor,
  onAbrir,
}: {
  itens: { name: string; value: number }[];
  cor: (nome: string) => string;
  onAbrir: () => void;
}) {
  const ordenado = [...itens].sort((a, b) => b.value - a.value);
  const topo = ordenado.slice(0, 7);
  const resto = ordenado.slice(7).reduce((s, i) => s + i.value, 0);
  const linhas = resto > 0 ? [...topo, { name: "Outras categorias", value: resto }] : topo;
  const total = ordenado.reduce((s, i) => s + i.value, 0) || 1;
  const maior = Math.max(...linhas.map((l) => l.value), 1);
  return (
    <div className="space-y-2.5">
      {linhas.map((l) => {
        const pct = (l.value / total) * 100;
        return (
          <button
            key={l.name}
            type="button"
            onClick={onAbrir}
            className="block w-full rounded-lg p-1 text-left hover:bg-muted/50"
          >
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium">{l.name}</span>
              <span className="shrink-0 tabular-nums">
                <strong>{formatarResumoValor(l.value)}</strong>
                <span className="ml-1.5 text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(l.value / maior) * 100}%`,
                  backgroundColor: l.name === "Outras categorias" ? "var(--muted-foreground)" : cor(l.name),
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem lançamentos neste mês.
    </div>
  );
}

/** Variação % contra o ciclo anterior (null sem base). */
function variacaoPct(atual: number, anterior: number): number | null {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
}

/** Topo do Finanças: saldo do mês em destaque, com receitas e despesas ao lado (visual 04/11/2026). */
function HeroMes({
  numeros,
  receitas,
  despesas,
  deltaReceitas,
  deltaDespesas,
  fixas,
  variaveis,
  mesRotulo,
}: {
  numeros: NumerosCiclo;
  receitas: number;
  despesas: number;
  deltaReceitas?: number | null;
  deltaDespesas?: number | null;
  fixas: number;
  variaveis: number;
  mesRotulo: string;
}) {
  const { formatar } = usePrivacidadeValores();
  const chip = (delta: number | null | undefined, bomSubir: boolean) =>
    delta != null && Number.isFinite(delta) ? (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
          delta >= 0 === bomSubir ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        }`}
      >
        {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {Math.abs(delta).toFixed(0)}% vs. ciclo anterior
      </span>
    ) : null;

  return (
    <section aria-label={`Resumo: ${mesRotulo}`} className="grid gap-px overflow-hidden rounded-3xl border bg-border shadow-[var(--shadow-card)] lg:grid-cols-[1.3fr_1fr]">
      <a href="#fluxo-caixa" className="block bg-card p-6 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:p-8">
        <SobraCiclo numeros={numeros} formatar={formatar} />
        <p className="mt-3 text-xs text-muted-foreground">{mesRotulo}. Toque para ver o fluxo de caixa.</p>
      </a>
      <div className="grid grid-rows-2 gap-px">
        <Link to="/receitas" className="flex items-center justify-between gap-4 bg-card px-6 py-5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-success/10 text-success"><ArrowUpRight className="size-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Receitas</p>
              <p className="text-xl font-bold tabular-nums">{formatar(receitas)}</p>
            </div>
          </div>
          {chip(deltaReceitas, true)}
        </Link>
        <Link to="/despesas" className="flex items-center justify-between gap-4 bg-card px-6 py-5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive"><ArrowDownRight className="size-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Despesas</p>
              <p className="text-xl font-bold tabular-nums">{formatar(despesas)}</p>
              <p className="text-xs text-muted-foreground">Fixas {formatar(fixas)}, variáveis {formatar(variaveis)}</p>
            </div>
          </div>
          {chip(deltaDespesas, false)}
        </Link>
      </div>
    </section>
  );
}


function StatCard({
  label,
  value,
  usd,
  cotacao,
  icon: Icon,
  tone,
  hint,
  display,
  delta,
  deltaGoodUp,
  to,
  search,
  href,
}: {
  label: string;
  value: number;
  usd?: number;
  cotacao?: number;
  icon: typeof Wallet;
  tone: "success" | "destructive" | "warning";
  hint?: string;
  display?: string;
  delta?: number | null;
  deltaGoodUp?: boolean;
  /** Rota pra onde o card navega ao ser clicado. Sem isso (e sem `href`), o card fica só informativo. */
  to?: string;
  /** Search params da rota de destino (ex.: { modo: "cartao" }). */
  search?: Record<string, string>;
  /** Âncora na própria página (ex.: "#fluxo-caixa"), pra quando o destino natural é um gráfico já visível no dashboard, não outra rota. */
  href?: string;
}) {
  const { formatarResumo: formatar } = usePrivacidadeValores();
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <p className="text-xl font-bold tracking-tight">{display ?? formatar(value)}</p>
        {delta != null && Number.isFinite(delta) && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              delta >= 0 === !!deltaGoodUp
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta).toFixed(0)}% vs. mês anterior
          </span>
        )}
      </div>
      {!!usd && !!cotacao && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          inclui {formatUSD(usd)} na cotação do dia
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const clicavel = !!to || !!href;
  return (
    <Card className={clicavel ? "overflow-hidden transition-colors hover:bg-muted/40" : "overflow-hidden"}>
      {to ? (
        <Link to={to} {...(search ? { search } : {})} className="block focus-visible:outline-none">
          <CardContent className="p-4">{body}</CardContent>
        </Link>
      ) : href ? (
        <a href={href} className="block focus-visible:outline-none">
          <CardContent className="p-4">{body}</CardContent>
        </a>
      ) : (
        <CardContent className="p-4">{body}</CardContent>
      )}
    </Card>
  );
}

/** Edição rápida de uma despesa direto do dashboard, sem sair da tela. */
function EditarDespesaDialog({ despesa, onClose }: { despesa: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: categorias = [] } = useCategorias("despesa");
  const [form, setForm] = useState({
    descricao: "",
    categoria: "",
    tipo: "variavel",
    responsavel: "",
  });

  useEffect(() => {
    if (!despesa) return;
    setForm({
      descricao: despesa.descricao ?? "",
      categoria: despesa.categoria ?? "",
      tipo: despesa.tipo ?? "variavel",
      responsavel: despesa.responsavel ?? "",
    });
  }, [despesa]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("despesas")
        .update({
          descricao: form.descricao,
          categoria: form.categoria,
          tipo: form.tipo,
          responsavel: form.responsavel || null,
        })
        .eq("id", despesa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      toast.success("Despesa atualizada.");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Não consegui salvar."),
  });

  return (
    <Dialog open={!!despesa} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm({ ...form, categoria: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(categorias as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Input
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 14/11/2026: "Dívida em aberto do mês" em barra empilhada (fixas x variáveis). Cada segmento abre Despesas já filtrada. */
function DividaEmAbertoCard({ itens, mes }: { itens: LancamentoCard[]; mes: string }) {
  const { formatarResumo, ocultoNesteItem } = usePrivacidadeValores("divida-aberto");
  const { prefs, save } = usePreferencias();
  const fixas = itens.filter((i) => i.despesa.tipo === "fixa").reduce((s, i) => s + i.valor, 0);
  const total = somaLancamentosCard(itens);
  const variaveis = total - fixas;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const alternar = () => {
    const prox = prefs.formato_valores === "completo" ? "mil" : prefs.formato_valores === "mil" ? "k" : "completo";
    save.mutate({ formato_valores: prox });
  };
  const segmentos = [
    { tipo: "fixa" as const, rotulo: "Fixas", valor: fixas, cor: "bg-primary" },
    { tipo: "variavel" as const, rotulo: "Variáveis", valor: variaveis, cor: "bg-warning" },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Dívida em aberto do mês</p>
          <Landmark className="size-4 text-destructive" />
        </div>
        <button
          type="button"
          onClick={alternar}
          title="Tocar para alternar a unidade (completo, mil, k)"
          className="mt-2 text-left text-xl font-bold tracking-tight"
        >
          {formatarResumo(total)}
        </button>
        <p className="mt-1 text-xs text-muted-foreground">{itens.length} lançamento(s) a pagar no ciclo</p>
        <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Dívida em aberto: fixas e variáveis">
          {segmentos.map((s) =>
            s.valor > 0 ? (
              <Link
                key={s.tipo}
                to="/despesas"
                search={{ filtro: "aberto", mes, tipo: s.tipo }}
                className={`${s.cor} h-full transition-[width] duration-500 hover:opacity-80`}
                style={{ width: `${(s.valor / total) * 100}%` }}
                title={`${s.rotulo} ${formatarResumo(s.valor)}`}
                aria-label={`${s.rotulo}: abrir despesas em aberto`}
              />
            ) : null,
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {segmentos.map((s) => (
            <Link key={s.tipo} to="/despesas" search={{ filtro: "aberto", mes, tipo: s.tipo }} className="inline-flex items-center gap-1.5 hover:underline">
              <span className={`size-2 rounded-full ${s.cor}`} />
              <span className="text-muted-foreground">{s.rotulo}</span>
              <span className="font-semibold tabular-nums">{formatarResumo(s.valor)}</span>
              <span className="text-muted-foreground">{ocultoNesteItem ? "" : `${pct(s.valor)}%`}</span>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}
