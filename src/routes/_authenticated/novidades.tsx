import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppLayout } from "@/components/AppLayout";
import { BetaTestFlight } from "@/components/BetaTestFlight";
import { OpenFinanceEmBreve } from "@/components/OpenFinanceEmBreve";
import { InstalarAppCartao } from "@/components/retencao/InstalarApp";
import { Card, CardContent } from "@/components/ui/card";
import { useNovidadeNaoLida } from "@/lib/novidades";

export const Route = createFileRoute("/_authenticated/novidades")({
  head: () => ({
    meta: [
      { title: "Novidades | Control ALL" },
      { name: "description", content: "O que mudou e o que vem por aí no Control ALL." },
    ],
  }),
  component: NovidadesPage,
});

const MUDOU = [
  "Início mais enxuta: saudação, ações rápidas, previsão do mês, cobranças para revisar e linha do tempo de 12 meses.",
  "O resumo do mês (total, variação e receita) agora fica em Finanças.",
  "Links de administração ficam só na página Administração.",
  "Quanto vale o seu tempo agora fica em Utilidades; na Início aparece o resultado.",
];

function NovidadesPage() {
  const { marcarLida } = useNovidadeNaoLida();
  useEffect(() => {
    marcarLida();
  }, [marcarLida]);
  return (
    <AppLayout title="Novidades" description="O que mudou e o que vem por aí.">
      <div className="space-y-6">
        <section aria-labelledby="mudou" className="space-y-3">
          <h2 id="mudou" className="text-xl font-extrabold tracking-tight">O que mudou</h2>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {MUDOU.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <InstalarAppCartao />
        </section>
        <section aria-labelledby="em-breve" className="space-y-3">
          <h2 id="em-breve" className="text-xl font-extrabold tracking-tight">Em breve</h2>
          <OpenFinanceEmBreve />
          <BetaTestFlight />
        </section>
      </div>
    </AppLayout>
  );
}
