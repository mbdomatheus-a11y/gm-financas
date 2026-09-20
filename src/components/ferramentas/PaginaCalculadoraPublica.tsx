import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Calculator } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Card, CardContent } from "@/components/ui/card";

export const calculadorasPublicas = [
  { href: "/calculadoras/diferenca-entre-datas", nome: "Diferença entre datas" },
  { href: "/calculadoras/somar-dias-a-data", nome: "Somar ou subtrair dias de uma data" },
  { href: "/calculadoras/somar-horarios", nome: "Somar e subtrair horários" },
] as const;

export function PaginaCalculadoraPublica({ titulo, descricao, children, explicacao, exemplo }: {
  titulo: string;
  descricao: string;
  children: ReactNode;
  explicacao: string;
  exemplo: string;
}) {
  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
      <Link to="/" className="flex items-center gap-2 font-bold"><BrandMark className="size-8" />Control ALL</Link>
      <Link to="/entrar" className="text-sm font-medium text-primary">Entrar <ArrowRight className="inline size-4" /></Link>
    </div></header>
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/calculadoras" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Todas as calculadoras</Link>
      <div className="mt-8 max-w-3xl"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Calculator className="size-4" /> CALCULADORAS GRATUITAS</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
        <p className="mt-4 text-muted-foreground">{descricao}</p>
      </div>
      <Card className="mt-8 max-w-3xl"><CardContent className="p-5 sm:p-7">{children}</CardContent></Card>
      <section className="mt-10 max-w-3xl space-y-3 text-sm leading-7"><h2 className="text-xl font-semibold">Como usar</h2><p>{explicacao}</p><p><strong>Exemplo:</strong> {exemplo}</p><p className="text-muted-foreground">O cálculo é feito no seu navegador. Os valores digitados nesta ferramenta não são salvos na sua conta.</p></section>
      <nav aria-label="Outras calculadoras" className="mt-12 border-t pt-7"><h2 className="text-xl font-semibold">Outras calculadoras</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{calculadorasPublicas.map((item) => <Link key={item.href} to={item.href} className="rounded-lg border p-4 text-sm font-medium hover:border-primary hover:text-primary">{item.nome} <ArrowRight className="mt-2 size-4" /></Link>)}</div></nav>
    </div>
  </main>;
}
