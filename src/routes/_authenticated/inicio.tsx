import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShoppingCart,
  Wallet,
  ArrowRight,
  ReceiptText,
  AlertTriangle,
  Eye,
  EyeOff,
  Calculator,
  CalendarClock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { AppLayout } from "@/components/AppLayout";
import { FaturaMesDialog } from "@/components/FaturaMesDialog";
import { VisaoGeralHome } from "@/components/VisaoGeralHome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useReceitas, useVeiculos } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { currentMonthKey, formatBRL, formatDate, monthKey, toBRL, toISODate } from "@/lib/format";
import { diferencaEntreDatas } from "@/lib/calculadora-datas";
import { diasRestantes, statusGarantia } from "@/lib/nfe";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";
import { alertasDosVeiculos } from "@/lib/veiculo-alertas";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Control ALL" },
      {
        name: "description",
        content: "Escolha entre acompanhar as finanças do casal ou organizar a lista de compras.",
      },
      { property: "og:title", content: "Início — Control ALL" },
      {
        property: "og:description",
        content: "Central do casal: finanças completas e lista de compras compartilhada.",
      },
    ],
  }),
  component: InicioPage,
});

function useListaResumo() {
  return useQuery({
    queryKey: ["lista-compras-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("comprado, lista")
        .eq("comprado", false);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useGarantias() {
  return useQuery({
    queryKey: ["garantias-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("id, estabelecimento, descricao, garantia_fim")
        .not("garantia_fim", "is", null)
        .order("garantia_fim");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function InicioPage() {
  const cotacao = useCotacao();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const { data: pendentes = [] } = useListaResumo();
  const { data: garantias = [] } = useGarantias();
  const { data: veiculos = [] } = useVeiculos();
  const { ocultarValores, toggle: toggleOcultar } = usePrivacidadeValores();

  const hoje = toISODate(new Date());
  const [dataCalcInicio, setDataCalcInicio] = useState(hoje);
  const [dataCalcFim, setDataCalcFim] = useState(hoje);
  const diasEntreDatas = useMemo(
    () =>
      dataCalcInicio && dataCalcFim
        ? diferencaEntreDatas(dataCalcInicio, dataCalcFim, "dias")
        : null,
    [dataCalcInicio, dataCalcFim],
  );

  const valorFmt = (val: number) => (ocultarValores ? "R$ ••••••" : formatBRL(val));

  const resumo = useMemo(() => {
    const mes = currentMonthKey();
    const rec = receitas
      .filter((r: any) => monthKey(r.data_recebimento) === mes)
      .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
    const des = lancamentosPorCompetencias(despesas as any[], [mes]).reduce(
      (s, p) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao),
      0,
    );
    return { rec, des, saldo: rec - des };
  }, [receitas, despesas, cotacao]);

  const compras = pendentes.filter((i: any) => i.lista === "compras").length;
  const unicos = pendentes.length - compras;

  const ativas = garantias.filter((g) => statusGarantia(g.garantia_fim) !== "expirada");
  const aVencer = garantias.filter((g) => {
    const st = statusGarantia(g.garantia_fim);
    return st === "critica" || st === "atencao";
  });
  const alertasVeiculos = useMemo(() => alertasDosVeiculos(veiculos as any[]), [veiculos]);

  const AREAS = [
    {
      to: "/dashboard" as const,
      titulo: "Finanças",
      descricao: "Dashboard, receitas, despesas, cartões, investimentos e faturas.",
      icon: Wallet,
      stats: [
        { label: "Receitas do mês", valor: valorFmt(resumo.rec), cor: "text-success" },
        { label: "Despesas do mês", valor: valorFmt(resumo.des), cor: "text-destructive" },
        {
          label: "Saldo",
          valor: valorFmt(resumo.saldo),
          cor: resumo.saldo >= 0 ? "text-success" : "text-destructive",
        },
      ],
    },
    {
      to: "/lista-compras" as const,
      titulo: "Lista de compras",
      descricao: "Alimentação, bens duráveis e diversão — organizados para o casal.",
      icon: ShoppingCart,
      stats: [
        { label: "A comprar", valor: String(compras), cor: "text-foreground" },
        { label: "Itens únicos", valor: String(unicos), cor: "text-foreground" },
      ],
    },
    {
      to: "/notas" as const,
      titulo: "Notas fiscais",
      descricao: "Comprovantes por foto ou QR Code, com controle de garantia.",
      icon: ReceiptText,
      stats: [
        { label: "Notas", valor: String(garantias.length), cor: "text-foreground" },
        { label: "Garantias ativas", valor: String(ativas.length), cor: "text-success" },
        {
          label: "Vencendo",
          valor: String(aVencer.length),
          cor: aVencer.length ? "text-destructive" : "text-foreground",
        },
      ],
    },
    {
      to: "/ferramentas" as const,
      titulo: "Control ALL",
      descricao: "Calculadora de datas e de horários — ferramentas de uso geral.",
      icon: Calculator,
      stats: [],
    },
  ];

  return (
    <AppLayout
      title="Início"
      description="Por onde você quer começar hoje?"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleOcultar}
            aria-label={ocultarValores ? "Mostrar valores" : "Ocultar valores"}
            title={ocultarValores ? "Mostrar valores" : "Ocultar valores"}
            className="size-9"
          >
            {ocultarValores ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </Button>
          <FaturaMesDialog />
        </div>
      }
    >
      {/* 1. Opções principais de entrada: Finanças, Lista e Notas Fiscais */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Acesso Rápido</h2>
            <p className="text-xs text-muted-foreground">Escolha por onde começar</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleOcultar}
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {ocultarValores ? (
              <>
                <EyeOff className="size-3.5" />
                <span>Valores ocultos</span>
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                <span>Ocultar valores</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {AREAS.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.to} to={a.to}>
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center justify-between">
                      <div className="gradient-brand flex size-11 items-center justify-center rounded-xl">
                        <Icon className="size-5 text-primary-foreground" />
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        Entrar <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold">{a.titulo}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{a.descricao}</p>
                    </div>
                    {a.stats.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {a.stats.map((s) => (
                          <div key={s.label} className="rounded-lg border bg-muted/30 px-2 py-1.5">
                            <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                              {s.label}
                            </p>
                            <p className={`truncate text-sm font-bold tabular-nums ${s.cor}`}>
                              {s.valor}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 1.5. Calculadora rápida de datas (atalho do módulo Control ALL) */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4.5 text-primary" />
              <p className="text-sm font-semibold">Diferença entre datas</p>
            </div>
            <Link
              to="/ferramentas"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Mais calculadoras <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="home-data-inicio" className="text-xs">
                Data inicial
              </Label>
              <Input
                id="home-data-inicio"
                type="date"
                value={dataCalcInicio}
                onChange={(e) => setDataCalcInicio(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-data-fim" className="text-xs">
                Data final
              </Label>
              <Input
                id="home-data-fim"
                type="date"
                value={dataCalcFim}
                onChange={(e) => setDataCalcFim(e.target.value)}
                className="w-40"
              />
            </div>
            {diasEntreDatas != null && (
              <div className="rounded-lg border bg-muted/30 px-4 py-2">
                <p className="text-xl font-bold tabular-nums">
                  {diasEntreDatas}{" "}
                  <span className="text-sm font-medium text-muted-foreground">dias</span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Alerta de garantias a vencer se houver */}
      {aVencer.length > 0 && (
        <Link to="/notas">
          <Card className="mb-6 border-warning/40 bg-warning/5 transition-colors hover:bg-warning/10">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 size-4.5 text-warning" />
              <div className="text-sm">
                <p className="font-medium">
                  {aVencer.length} garantia{aVencer.length > 1 ? "s" : ""} vencendo em até 30 dias
                </p>
                <p className="text-xs text-muted-foreground">
                  {aVencer
                    .slice(0, 3)
                    .map(
                      (g) =>
                        `${g.estabelecimento ?? g.descricao ?? "Nota"} — ${formatDate(g.garantia_fim!)} (${diasRestantes(g.garantia_fim)}d)`,
                    )
                    .join(" · ")}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* 2b. Alerta de veículos (óleo/revisão, IPVA, seguro) se houver */}
      {alertasVeiculos.length > 0 && (
        <Link to="/veiculos">
          <Card className="mb-6 border-warning/40 bg-warning/5 transition-colors hover:bg-warning/10">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 size-4.5 text-warning" />
              <div className="text-sm">
                <p className="font-medium">
                  {alertasVeiculos.length} alerta{alertasVeiculos.length > 1 ? "s" : ""} de veículo
                </p>
                <p className="text-xs text-muted-foreground">
                  {alertasVeiculos
                    .slice(0, 3)
                    .map((a) => `${a.veiculoNome} — ${a.mensagem}`)
                    .join(" · ")}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* 3. Gráfico da Linha do Tempo e visão geral dos 12 meses */}
      <VisaoGeralHome ocultarValores={ocultarValores} />
    </AppLayout>
  );
}
