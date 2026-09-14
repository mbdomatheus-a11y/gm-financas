import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, CalendarPlus, Info, Syringe, Timer } from "lucide-react";

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
      { title: "Control ALL — Ferramentas" },
      {
        name: "description",
        content:
          "Calculadoras de data, horário e o Simulador Interativo — ferramentas de uso geral do módulo Control ALL.",
      },
      { property: "og:title", content: "Control ALL — Ferramentas" },
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
      title="Control ALL"
      description="Ferramentas de uso geral — sem relação com seus dados financeiros."
    >
      <div className="space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 size-4.5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Sobre o módulo Control ALL</p>
              <p className="mt-1 text-muted-foreground">
                Este é um conjunto de calculadoras e ferramentas de uso geral (datas, horários,
                diluições e as que forem adicionadas depois) que não dependem de nenhum dado
                financeiro do casal — funcionam do mesmo jeito pra qualquer pessoa. A ideia é
                evoluir esse módulo aos poucos até virar um produto independente, que poderá
                futuramente ser oferecido separadamente deste app. Por enquanto ele mora aqui
                dentro, mas o que você digita aqui não é salvo em lugar nenhum — cada cálculo é só
                local, na sua tela. A mesma versão fica disponível publicamente, sem login, na
                página inicial do site.
              </p>
              <Badge variant="outline" className="mt-2 border-primary/40 text-primary">
                Em construção
              </Badge>
            </div>
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
