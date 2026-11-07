import { lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileUp, Plus, Sparkles, TrendingUp } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { CartaoCarregando } from "@/components/CartaoCarregando";
import { SugestoesEconomia } from "@/components/SugestoesEconomia";
import { AssistenteHome } from "@/components/AssistenteHome";
import { PerguntaFechamento } from "@/components/PerguntaFechamento";
import { PrimeirosPassos as PrimeirosPassosCard } from "@/components/PrimeirosPassos";
import { MinhasContasCard } from "@/components/MinhasContasCard";
import { LimitesResumoCard } from "@/components/LimitesResumoCard";
import { useProfile } from "@/hooks/useAuthData";
import { TempoInicioCard } from "@/components/GamificacaoFinanceira";

// Componentes com gráficos (recharts) carregam sob demanda para aliviar o JS inicial.
const ResumoPrevisaoHome = lazy(() =>
  import("@/components/ResumoPrevisaoHome").then((m) => ({ default: m.ResumoPrevisaoHome })),
);
const VisaoGeralHome = lazy(() =>
  import("@/components/VisaoGeralHome").then((m) => ({ default: m.VisaoGeralHome })),
);
import { NOVIDADE_TITULO, useNovidadeNaoLida } from "@/lib/novidades";

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
 * Início (07/11/2026): saudação, ações rápidas, pergunta do fechamento, previsão do mês,
 * cobranças para revisar, economia conquistada e linha do tempo. Menus, administração,
 * resumo do mês e novidades saíram daqui (ver spec-inicio-2026-11-07).
 */
function InicioPage() {
  const { data: profile } = useProfile();
  const { naoLida } = useNovidadeNaoLida();
  const primeiroNome = String((profile as any)?.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const hoje = new Date();
  const dataLonga = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <AppLayout
      title={primeiroNome ? `${saudacao(hoje)}, ${primeiroNome}` : saudacao(hoje)}
      description={dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}
    >
      <div data-entrada className="space-y-6">
        {naoLida && (
          <Link
            to="/novidades"
            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>Novidade: {NOVIDADE_TITULO}</span>
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              Ver <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        )}
        <AcoesRapidas />
        <PrimeirosPassosCard />
        <PerguntaFechamento />
        {/* Duas colunas no computador: previsão em destaque e, ao lado, assistente, contas e limites */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:items-start">
          <Suspense fallback={<CartaoCarregando />}>
            <ResumoPrevisaoHome className="overflow-hidden" />
          </Suspense>
          <div className="space-y-6 xl:sticky xl:top-24">
            <AssistenteHome />
            <MinhasContasCard />
            <LimitesResumoCard />
          </div>
        </div>
        <SugestoesEconomia className="overflow-hidden" />
        <TempoInicioCard />
        <Suspense fallback={<CartaoCarregando />}>
          <VisaoGeralHome parte="inicio" />
        </Suspense>
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
