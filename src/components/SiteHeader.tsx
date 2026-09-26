import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LegalDialogs } from "@/components/LegalDialogs";
import { Button } from "@/components/ui/button";

/**
 * Header público, compartilhado entre a home (/) e as páginas de
 * ferramenta gratuita (/calculadoras, /links-temporarios). Sempre fixo no
 * topo (sticky) e sempre com os mesmos links — pra que o usuário nunca
 * "perca" o menu ao navegar entre essas páginas (pedido do proprietário,
 * 2026-09-26). Em páginas que não são a home, os links "Recursos" e
 * "Módulos" apontam de volta pra home com a âncora (`/#recursos`), já que
 * essas seções só existem lá.
 *
 * `home`: true quando renderizado dentro da própria LandingPage (usa
 * âncoras puras "#recursos"); false nas outras páginas (usa "/#recursos").
 */
export function SiteHeader({ home = false }: { home?: boolean }) {
  const ancora = (id: string) => (home ? `#${id}` : `/#${id}`);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <BrandMark className="size-8" />
          Control ALL
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <a href={ancora("recursos")}>Recursos</a>
          <a href={ancora("modulos")}>Módulos</a>
          <Link
            to="/calculadoras"
            className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary transition hover:bg-primary/20"
          >
            Calculadoras
          </Link>
          <Link
            to="/links-temporarios"
            className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary transition hover:bg-primary/20"
          >
            Link temporário
          </Link>
          <a href={ancora("demonstracao")}>Demonstração</a>
          <a href={ancora("precos")}>Preços</a>
          <LegalDialogs />
        </nav>
        <Button asChild size="sm">
          <Link to="/entrar">
            Entrar <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
