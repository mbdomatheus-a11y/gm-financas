import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Header público, compartilhado entre a home (/) e as páginas de
 * ferramenta gratuita (/calculadoras, /links-temporarios, termos, privacidade).
 * Sempre fixo no topo e sempre com os mesmos links. Em páginas que não são a
 * home, as âncoras apontam de volta pra home (`/#recursos`).
 *
 * Revisão 2026-10-06: todas as âncoras existem na home, o menu tem versão
 * para celular (antes sumia abaixo de 768px) e Termos/Privacidade são links
 * reais para as páginas próprias.
 */
export function SiteHeader({ home = false }: { home?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const ancora = (id: string) => (home ? `#${id}` : `/#${id}`);

  const classeLink = "text-sm text-muted-foreground transition-colors hover:text-foreground";
  const classePilula =
    "rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition hover:bg-primary/20";

  const itens = (aoClicar?: () => void) => (
    <>
      <a href={ancora("recursos")} className={classeLink} onClick={aoClicar}>
        Recursos
      </a>
      <a href={ancora("modulos")} className={classeLink} onClick={aoClicar}>
        Módulos
      </a>
      <Link to="/calculadoras" className={classePilula} onClick={aoClicar}>
        Calculadoras
      </Link>
      <Link to="/links-temporarios" className={classePilula} onClick={aoClicar}>
        Link temporário
      </Link>
      <a href={ancora("demonstracao")} className={classeLink} onClick={aoClicar}>
        Demonstração
      </a>
      <a href={ancora("precos")} className={classeLink} onClick={aoClicar}>
        Preços
      </a>
      <Link to="/termos-de-uso" className={classeLink} onClick={aoClicar}>
        Termos
      </Link>
      <Link to="/privacidade" className={classeLink} onClick={aoClicar}>
        Privacidade
      </Link>
    </>
  );

  return (
    <header className="glass sticky top-0 z-30 border-b border-border/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <BrandMark className="size-8" />
          Control ALL
        </Link>
        <nav className="hidden items-center gap-5 lg:flex" aria-label="Principal">
          {itens()}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/entrar">
              Entrar <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <nav className="mt-8 flex flex-col items-start gap-4" aria-label="Menu do site">
                {itens(() => setAberto(false))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
