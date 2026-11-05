import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/AppLayout";
import { HomeWidgets } from "@/components/HomeWidgets";
import { ResumoPrevisaoHome } from "@/components/ResumoPrevisaoHome";
import { SugestoesEconomia } from "@/components/SugestoesEconomia";
import { ModoClienteControle } from "@/components/ModoClienteControle";
import { OpenFinanceEmBreve } from "@/components/OpenFinanceEmBreve";
import { AssistenteHome } from "@/components/AssistenteHome";
import { BetaTestFlight } from "@/components/BetaTestFlight";
import { PerguntaFechamento } from "@/components/PerguntaFechamento";
import { InstalarAppCartao } from "@/components/retencao/InstalarApp";
import { useProfile } from "@/hooks/useAuthData";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início | Control ALL" },
      { name: "description", content: "Escolha o que deseja acessar." },
      { property: "og:title", content: "Início | Control ALL" },
      { property: "og:description", content: "Central de acesso do Control ALL." },
    ],
  }),
  component: InicioPage,
});

function saudacao(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * Rework do Início (04/11/2026): saudação no topo, conteúdo principal primeiro
 * (pergunta do fechamento, previsão, sugestões, assistente, atalhos) e os avisos
 * de novidade (Open Finance, app, beta) agrupados no fim, para não empurrar o resumo para baixo.
 */
function InicioPage() {
  const { data: profile } = useProfile();
  const primeiroNome = String((profile as any)?.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const hoje = new Date();
  const dataLonga = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <AppLayout
      title={primeiroNome ? `${saudacao(hoje)}, ${primeiroNome}` : saudacao(hoje)}
      description={dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}
    >
      <div data-entrada>
      <ModoClienteControle className="mb-4" />
      <PerguntaFechamento />
      <ResumoPrevisaoHome />
      <SugestoesEconomia />
      <AssistenteHome />
      <HomeWidgets />
      <section aria-label="Novidades" className="mt-8 space-y-3">
        <h2 className="text-base font-bold tracking-tight text-muted-foreground">Novidades</h2>
        <InstalarAppCartao />
        <BetaTestFlight />
        <OpenFinanceEmBreve />
      </section>
      </div>
    </AppLayout>
  );
}
