import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ShoppingCart, Wallet, ArrowRight, ReceiptText, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useReceitas } from "@/hooks/useFinance";
import { currentMonthKey, formatBRL, formatDate, monthKey, toBRL } from "@/lib/format";
import { diasRestantes, statusGarantia } from "@/lib/nfe";


export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Finanças do Casal" },
      {
        name: "description",
        content: "Escolha entre acompanhar as finanças do casal ou organizar a lista de compras.",
      },
      { property: "og:title", content: "Início — Finanças do Casal" },
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



  const resumo = useMemo(() => {
    const mes = currentMonthKey();
    const rec = receitas
      .filter((r: any) => monthKey(r.data_recebimento) === mes)
      .reduce((s: number, r: any) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
    let des = 0;
    for (const d of despesas as any[])
      for (const p of d.parcelas ?? [])
        if (monthKey(p.vencimento) === mes) des += toBRL(Number(p.valor), d.moeda, cotacao);
    return { rec, des, saldo: rec - des };
  }, [receitas, despesas, cotacao]);

  const compras = pendentes.filter((i: any) => i.lista === "compras").length;
  const unicos = pendentes.length - compras;

  const ativas = garantias.filter((g) => statusGarantia(g.garantia_fim) !== "expirada");
  const aVencer = garantias.filter((g) => {
    const st = statusGarantia(g.garantia_fim);
    return st === "critica" || st === "atencao";
  });

  const AREAS = [
    {
      to: "/dashboard" as const,
      titulo: "Finanças",
      descricao: "Dashboard, receitas, despesas, cartões, investimentos e faturas.",
      icon: Wallet,
      stats: [
        { label: "Receitas do mês", valor: formatBRL(resumo.rec), cor: "text-success" },
        { label: "Despesas do mês", valor: formatBRL(resumo.des), cor: "text-destructive" },
        {
          label: "Saldo",
          valor: formatBRL(resumo.saldo),
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
  ];

  return (
    <AppLayout title="Início" description="Por onde você quer começar hoje?">
      {aVencer.length > 0 && (
        <Link to="/notas">
          <Card className="mb-4 border-warning/40 bg-warning/5">
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

      <div className="grid gap-4 sm:grid-cols-2">
        {AREAS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="gradient-brand flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold">{a.titulo}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.descricao}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {a.stats.map((s) => (
                      <div key={s.label} className="rounded-lg border bg-muted/30 px-2 py-1.5">
                        <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                          {s.label}
                        </p>
                        <p className={`truncate text-sm font-bold tabular-nums ${s.cor}`}>{s.valor}</p>
                      </div>
                    ))}
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    Entrar <ArrowRight className="size-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppLayout>
  );
}
