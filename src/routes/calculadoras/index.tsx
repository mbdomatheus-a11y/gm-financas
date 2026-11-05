import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { calculadorasPublicas } from "@/components/ferramentas/PaginaCalculadoraPublica";

export const Route = createFileRoute("/calculadoras/")({
  head: () => ({ meta: [
    { title: "Calculadoras gratuitas de datas e horários | Control ALL" },
    { name: "description", content: "Calcule a diferença entre datas, some dias a uma data e faça contas com horários gratuitamente, sem cadastro." },
    { property: "og:title", content: "Calculadoras gratuitas | Control ALL" },
  ], links: [{ rel: "canonical", href: "https://www.controlall.com.br/calculadoras" }] }),
  component: CalculadorasPage,
});

function CalculadorasPage() {
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader />
    <div className="mx-auto max-w-5xl px-4 py-16"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Calculator className="size-4" /> Ferramentas gratuitas</p><h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Calculadoras de datas e horários</h1><p className="mt-4 max-w-2xl text-lg text-muted-foreground">Contas do dia a dia, sem cadastro e com resultado na hora.</p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">{calculadorasPublicas.map((item) => <Link key={item.href} to={item.href} className="rounded-3xl border bg-card p-6 shadow-sm transition-colors hover:border-primary"><h2 className="text-lg font-semibold">{item.nome}</h2><span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">Abrir calculadora <ArrowRight className="size-4" /></span></Link>)}</div>
      <p className="mt-12 text-sm text-muted-foreground">O cálculo é feito no seu navegador e nada é salvo na sua conta.</p>
    </div></main>;
}
