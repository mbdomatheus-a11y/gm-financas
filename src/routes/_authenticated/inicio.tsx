import { createFileRoute, Link } from "@tanstack/react-router";
import { FileUp, Plus, Sparkles, TrendingUp } from "lucide-react";

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
      <div data-entrada className="space-y-6">
        <ModoClienteControle />
        <AcoesRapidas />
        <PerguntaFechamento />
        {/* Duas colunas no computador: previsão em destaque e, ao lado, assistente e revisões */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:items-start">
          <ResumoPrevisaoHome className="overflow-hidden" />
          <div className="space-y-6 xl:sticky xl:top-24">
            <AssistenteHome />
            <SugestoesEconomia className="overflow-hidden" />
          </div>
        </div>
        <HomeWidgets />
        <section aria-labelledby="novidades" className="space-y-3 pt-4">
          <h2 id="novidades" className="text-xl font-extrabold tracking-tight">Novidades</h2>
          <InstalarAppCartao />
          <BetaTestFlight />
          <OpenFinanceEmBreve />
        </section>
      </div>
    </AppLayout>
  );
}

/** Ações rápidas do Início (05/11/2026): o que a pessoa mais faz, a um toque. */
function AcoesRapidas() {
  const itens = [
    { rotulo: "Lançar gasto", detalhe: "despesa ou receita", icone: Plus, cor: "bg-primary text-primary-foreground", acao: () => window.dispatchEvent(new Event("abrir-lancamento-rapido")) },
    { rotulo: "Nova receita", detalhe: "salário, extra", icone: TrendingUp, cor: "bg-success/12 text-success", to: "/receitas" as const },
    { rotulo: "Importar fatura", detalhe: "PDF ou foto", icone: FileUp, cor: "bg-muted text-foreground", to: "/importar" as const },
    { rotulo: "Perguntar à IA", detalhe: "sobre seu mês", icone: Sparkles, cor: "bg-muted text-foreground", acao: () => window.dispatchEvent(new Event("abrir-controlia")) },
  ];
  const classe =
    "group flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 pr-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--brand)_35%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 motion-reduce:hover:translate-y-0";
  return (
    <nav aria-label="Ações rápidas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map((i) => {
        const Icone = i.icone;
        const conteudo = (
          <>
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${i.cor}`}>
              <Icone className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{i.rotulo}</span>
              <span className="block truncate text-xs text-muted-foreground">{i.detalhe}</span>
            </span>
          </>
        );
        return i.to ? (
          <Link key={i.rotulo} to={i.to} {...((i.to === "/receitas" ? { search: { novo: true } } : {}) as any)} className={classe}>
            {conteudo}
          </Link>
        ) : (
          <button key={i.rotulo} type="button" onClick={i.acao} className={classe}>
            {conteudo}
          </button>
        );
      })}
    </nav>
  );
}
