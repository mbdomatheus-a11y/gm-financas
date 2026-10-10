import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CalendarClock, CalendarPlus, Info, Syringe, Timer } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { obterAvisoCalculadora } from "@/lib/aviso-calculadora.functions";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DiferencaEntreDatas } from "@/components/ferramentas/DiferencaEntreDatas";
import { DataMaisIntervalo } from "@/components/ferramentas/DataMaisIntervalo";
import { CalculadoraHorarios } from "@/components/ferramentas/CalculadoraHorarios";
import { SimuladorInterativo } from "@/components/ferramentas/SimuladorInterativo";

export const Route = createFileRoute("/_authenticated/ferramentas")({
  head: () => ({
    meta: [
      { title: "Calculadora — Control ALL" },
      {
        name: "description",
        content:
          "Calculadoras de data, horário e o Simulador Interativo — ferramentas de uso geral do módulo Calculadora.",
      },
      { property: "og:title", content: "Calculadora — Control ALL" },
      {
        property: "og:description",
        content: "Calculadoras de uso geral, sem relação com seus dados financeiros.",
      },
    ],
  }),
  component: FerramentasPage,
});

function FerramentasPage() {
  return (
    <AppLayout
      title="Utilidades"
      description="Calculadoras e link temporário — sem relação com seus dados financeiros."
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">Link temporário</p>
              <p className="text-sm text-muted-foreground">
                Crie um link que expira para compartilhar algo sem deixar aberto para sempre.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/links-temporarios">Abrir link temporário</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4.5" /> Diferença entre datas
            </CardTitle>
            <CardDescription>
              Quantos segundos, minutos, horas, dias, anos ou séculos há entre duas datas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DiferencaEntreDatas />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="size-4.5" /> Data mais (ou menos) um intervalo
            </CardTitle>
            <CardDescription>
              Ex.: que dia é 01/01/2028 mais 90 dias, ou 6 meses antes de uma data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataMaisIntervalo />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="size-4.5" /> Soma e subtração de horários
            </CardTitle>
            <CardDescription>Ex.: 08:00 + 7:20 − 1:15.</CardDescription>
          </CardHeader>
          <CardContent>
            <CalculadoraHorarios />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Syringe className="size-4.5" /> Simulador Interativo
            </CardTitle>
            <CardDescription>
              Conversor de dose/diluição e visualização de seringa — só para uso acadêmico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimuladorInterativo />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
