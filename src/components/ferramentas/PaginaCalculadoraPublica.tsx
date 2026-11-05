import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Calculator } from "lucide-react";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, CardContent } from "@/components/ui/card";

export const calculadorasPublicas = [
  { href: "/calculadoras/diferenca-entre-datas", nome: "Diferença entre datas" },
  { href: "/calculadoras/somar-dias-a-data", nome: "Somar ou subtrair dias de uma data" },
  { href: "/calculadoras/somar-horarios", nome: "Somar e subtrair horários" },
  { href: "/calculadoras/simulador-de-dose-diluicao", nome: "Simulador de dose e diluição (uso acadêmico)" },
] as const;

export function PaginaCalculadoraPublica({ titulo, descricao, children, explicacao, exemplo }: {
  titulo: string;
  descricao: string;
  children: ReactNode;
  explicacao: string;
  exemplo: string;
}) {
  return <main className="min-h-screen bg-background text-foreground">
    <SiteHeader />
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link to="/calculadoras" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Todas as calculadoras</Link>
      <div className="mt-10 max-w-3xl"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Calculator className="size-4" /> Calculadoras gratuitas</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">{titulo}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{descricao}</p>
      </div>
      <Card className="mt-10 max-w-3xl"><CardContent className="p-6 sm:p-8">{children}</CardContent></Card>
      <section className="mt-12 max-w-3xl space-y-3 text-sm leading-7"><h2 className="text-xl font-semibold">Como usar</h2><p>{explicacao}</p><p><strong>Exemplo:</strong> {exemplo}</p><p className="text-muted-foreground">O cálculo é feito no seu navegador e nada é salvo na sua conta.</p></section>
      <nav aria-label="Outras calculadoras" className="mt-12 border-t pt-8"><h2 className="text-xl font-semibold">Outras calculadoras</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{calculadorasPublicas.map((item) => <Link key={item.href} to={item.href} className="rounded-3xl border bg-card p-5 text-sm font-medium transition-colors hover:border-primary hover:text-primary">{item.nome} <ArrowRight className="mt-2 size-4" /></Link>)}</div></nav>
    </div>
  </main>;
}
