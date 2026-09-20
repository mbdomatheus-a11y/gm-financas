import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
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
  return <main className="min-h-screen bg-background text-foreground"><header className="border-b"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4"><Link to="/" className="flex items-center gap-2 font-bold"><BrandMark className="size-8" />Control ALL</Link><Link to="/entrar" className="text-sm font-medium text-primary">Entrar</Link></div></header>
    <div className="mx-auto max-w-5xl px-4 py-12"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Calculator className="size-4" /> FERRAMENTAS GRATUITAS</p><h1 className="mt-3 text-4xl font-bold">Calculadoras de datas e horários</h1><p className="mt-4 max-w-2xl text-muted-foreground">Resolva contas do dia a dia sem cadastro. Escolha uma calculadora e veja o resultado na hora.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">{calculadorasPublicas.map((item) => <Link key={item.href} to={item.href} className="rounded-xl border bg-card p-6 shadow-sm transition-colors hover:border-primary"><h2 className="text-lg font-semibold">{item.nome}</h2><span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">Abrir calculadora <ArrowRight className="size-4" /></span></Link>)}</div>
      <p className="mt-10 text-sm text-muted-foreground">Os valores digitados são calculados no seu navegador e não são salvos na sua conta.</p>
    </div></main>;
}
