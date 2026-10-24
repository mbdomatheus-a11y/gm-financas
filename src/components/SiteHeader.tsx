import { useEffect, useState } from "react";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, ChevronDown, Link2, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Header público (home, calculadoras, link temporário, sobre, termos, privacidade, cookies).
 * Revisão 24/10/2026: menu enxuto que não quebra linha (whitespace-nowrap), ferramentas num
 * menu suspenso, efeito vidro ao rolar, e menu de celular em tela cheia com botões grandes.
 * Termos, Privacidade e Cookies ficam no rodapé e no menu do celular.
 */
export function SiteHeader({ home = false }: { home?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const ancora = (id: string) => (home ? `#${id}` : `/#${id}`);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  const links = [
    { href: ancora("recursos"), rotulo: "Recursos" },
    { href: ancora("modulos"), rotulo: "Módulos" },
    { href: ancora("como-funciona"), rotulo: "Como funciona" },
    { href: ancora("precos"), rotulo: "Preços" },
    { href: ancora("perguntas"), rotulo: "Perguntas" },
  ];
  const classeLink =
    "whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
        rolou
          ? "border-border/70 bg-background/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
          : "border-transparent bg-background"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[1.05rem] font-extrabold tracking-tight">
          <BrandMark className="size-9 rounded-xl" />
          <span>
            Control<span className="text-primary">ALL</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 items-center gap-0.5 lg:flex" aria-label="Principal">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={classeLink}>
              {l.rotulo}
            </a>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className={`${classeLink} inline-flex items-center gap-1`}>
              Ferramentas <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64 rounded-2xl p-2">
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3">
                <Link to="/calculadoras" className="flex items-start gap-3">
                  <Calculator className="mt-0.5 size-4 text-primary" />
                  <span>
                    <span className="block font-medium">Calculadoras</span>
                    <span className="block text-xs text-muted-foreground">Juros, parcelas, datas e mais. Grátis.</span>
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3">
                <Link to="/links-temporarios" className="flex items-start gap-3">
                  <Link2 className="mt-0.5 size-4 text-primary" />
                  <span>
                    <span className="block font-medium">Link temporário</span>
                    <span className="block text-xs text-muted-foreground">Compartilhe algo que some sozinho.</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/sobre" className={classeLink}>
            Sobre
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SeletorIdioma />
          <Button asChild size="sm" className="h-10 rounded-full px-4 font-semibold shadow-sm">
            <Link to="/entrar">
              Entrar <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10 rounded-full lg:hidden" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm [&>button]:hidden">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-16 items-center justify-between border-b px-4">
                <span className="flex items-center gap-2.5 font-extrabold">
                  <BrandMark className="size-8 rounded-lg" /> Control<span className="-ml-2.5 text-primary">ALL</span>
                </span>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Fechar menu">
                    <X className="size-5" />
                  </Button>
                </SheetClose>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu do site">
                <div className="grid gap-1">
                  {links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setAberto(false)}
                      className="rounded-xl px-3 py-3.5 text-lg font-semibold active:bg-muted"
                    >
                      {l.rotulo}
                    </a>
                  ))}
                  <Link to="/sobre" onClick={() => setAberto(false)} className="rounded-xl px-3 py-3.5 text-lg font-semibold active:bg-muted">
                    Sobre o Control ALL
                  </Link>
                </div>
                <p className="mt-5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ferramentas grátis</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    to="/calculadoras"
                    onClick={() => setAberto(false)}
                    className="flex flex-col gap-2 rounded-2xl bg-primary/10 p-4 text-sm font-semibold text-primary"
                  >
                    <Calculator className="size-5" /> Calculadoras
                  </Link>
                  <Link
                    to="/links-temporarios"
                    onClick={() => setAberto(false)}
                    className="flex flex-col gap-2 rounded-2xl bg-primary/10 p-4 text-sm font-semibold text-primary"
                  >
                    <Link2 className="size-5" /> Link temporário
                  </Link>
                </div>
                <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 px-3 text-sm text-muted-foreground">
                  <Link to="/termos-de-uso" onClick={() => setAberto(false)}>Termos</Link>
                  <Link to="/privacidade" onClick={() => setAberto(false)}>Privacidade</Link>
                  <Link to="/cookies" onClick={() => setAberto(false)}>Cookies</Link>
                </div>
              </nav>
              <div className="grid gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button asChild size="lg" className="h-12 rounded-full text-base font-semibold">
                  <Link to="/entrar" search={{ criar: true }} onClick={() => setAberto(false)}>
                    Criar minha conta grátis <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full text-base">
                  <Link to="/entrar" onClick={() => setAberto(false)}>
                    Já tenho conta
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
