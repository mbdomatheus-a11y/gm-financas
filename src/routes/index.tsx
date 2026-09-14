import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarClock, CalendarPlus, LogIn, Syringe, Timer, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandAnimado } from "@/components/ferramentas/BrandAnimado";
import { DiferencaEntreDatas } from "@/components/ferramentas/DiferencaEntreDatas";
import { DataMaisIntervalo } from "@/components/ferramentas/DataMaisIntervalo";
import { CalculadoraHorarios } from "@/components/ferramentas/CalculadoraHorarios";
import { SimuladorInterativo } from "@/components/ferramentas/SimuladorInterativo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control ALL — Calculadoras de data, horário e diluição grátis" },
      {
        name: "description",
        content:
          "Ferramentas gratuitas de uso geral: diferença entre datas (com anos e séculos), data mais um intervalo, soma de horários e um simulador interativo de diluição/seringa para uso acadêmico.",
      },
      { property: "og:title", content: "Control ALL — Calculadoras grátis" },
      {
        property: "og:description",
        content:
          "Ferramentas de uso geral: calculadora de datas, horários e um simulador interativo acadêmico.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  // Só visitante sem sessão fica nesta página — quem já está logado é
  // levado direto pro hub de finanças, sem precisar navegar de novo.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio" });
    });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="gradient-brand flex size-8 items-center justify-center rounded-lg">
              <Wallet className="size-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold">Control ALL</span>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/entrar">
              <LogIn className="size-3.5" /> Entrar
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="mb-10 text-center">
          <BrandAnimado className="justify-center" />
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Calculadoras gratuitas de uso geral — datas, horários e diluição — sem cadastro, sem
            salvar nada. Prefere controlar as finanças da família também?{" "}
            <Link
              to="/entrar"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Conheça o Control ALL completo
            </Link>
            .
          </p>
        </div>

        <Tabs defaultValue="tempo" className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 bg-muted p-1 sm:grid-cols-4">
            <TabsTrigger value="tempo" className="gap-1.5 py-2 text-xs sm:text-sm">
              <CalendarClock className="size-4" /> Entre datas
            </TabsTrigger>
            <TabsTrigger value="intervalo" className="gap-1.5 py-2 text-xs sm:text-sm">
              <CalendarPlus className="size-4" /> Data + intervalo
            </TabsTrigger>
            <TabsTrigger value="horarios" className="gap-1.5 py-2 text-xs sm:text-sm">
              <Timer className="size-4" /> Horários
            </TabsTrigger>
            <TabsTrigger value="simulador" className="gap-1.5 py-2 text-xs sm:text-sm">
              <Syringe className="size-4" /> Simulador
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tempo">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-1 text-base font-semibold">Diferença entre datas</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Quantos segundos, minutos, horas, dias, anos ou séculos há entre duas datas.
                </p>
                <DiferencaEntreDatas />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intervalo">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-1 text-base font-semibold">Data mais (ou menos) um intervalo</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Ex.: que dia é 01/01/2028 mais 90 dias, ou 6 meses antes de uma data.
                </p>
                <DataMaisIntervalo />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="horarios">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-1 text-base font-semibold">Soma e subtração de horários</h2>
                <p className="mb-4 text-sm text-muted-foreground">Ex.: 08:00 + 7:20 − 1:15.</p>
                <CalculadoraHorarios />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulador">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-1 text-base font-semibold">Simulador Interativo</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Conversor de dose/diluição e visualização de seringa — só para uso acadêmico.
                </p>
                <SimuladorInterativo />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-10 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="font-medium">Já usa o Control ALL pras finanças da casa?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Entre com seu CPF pra ver receitas, despesas, cartões e investimentos.
              </p>
            </div>
            <Button asChild className="shrink-0 gap-1.5">
              <Link to="/entrar">
                <LogIn className="size-4" /> Entrar
              </Link>
            </Button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nada do que você digita aqui é salvo — cada cálculo acontece só no seu navegador.
        </p>
      </div>
    </main>
  );
}
