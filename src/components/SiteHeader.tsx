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
 * Revisão 05/11/2026: barra fina no padrão "vidro" (h-12/h-14), translúcida com blur e
 * saturação, borda inferior que só aparece depois de rolar, links pequenos com sublinhado
 * animado, painel de vidro para Ferramentas e menu de celular em tela cheia translúcido.
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

  const foco =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0";
  // Link da barra: texto pequeno, cor suave, sublinhado fino que cresce do centro no hover.
  const classeLink = `group relative inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium tracking-[-0.01em] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground data-[state=open]:text-foreground motion-reduce:transition-none ${foco}`;
  const sublinhado = (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-2.5 -bottom-px h-px origin-center scale-x-0 rounded-full bg-foreground/70 transition-transform duration-200 ease-out group-hover:scale-x-100 group-data-[state=open]:scale-x-100 motion-reduce:transition-none"
    />
  );
  const classeLinkCelular = `block rounded-xl px-2 py-2.5 text-2xl font-semibold tracking-tight text-foreground/90 transition-colors duration-150 hover:text-foreground active:bg-muted/70 motion-reduce:transition-none ${foco}`;
  const fechar = () => setAberto(false);

  return (
    <header
      className={`sticky top-0 z-30 border-b bg-background/70 backdrop-blur-xl backdrop-saturate-150 transition-[border-color,background-color] duration-300 motion-reduce:transition-none supports-[backdrop-filter]:bg-background/60 ${
        rolou ? "border-border/60" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4 sm:h-14">
        <Link
          to="/"
          aria-label="Control ALL, página inicial"
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-extrabold tracking-tight ${foco}`}
        >
          <BrandMark className="size-7 rounded-lg" />
          <span>
            Control<span className="text-primary">ALL</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 items-center gap-0.5 lg:flex" aria-label="Principal">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={classeLink}>
              {l.rotulo}
              {sublinhado}
            </a>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className={classeLink}>
              Ferramentas
              <ChevronDown
                aria-hidden="true"
                className="size-3 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
              />
              {sublinhado}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              sideOffset={10}
              className="w-72 rounded-2xl border-border/60 bg-background/90 p-1.5 shadow-lg shadow-black/5 backdrop-blur-xl backdrop-saturate-150 duration-200 motion-reduce:animate-none dark:shadow-black/40"
            >
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3 focus:bg-muted/70">
                <Link to="/calculadoras" className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Calculator className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">Calculadoras</span>
                    <span className="block text-xs text-muted-foreground">Juros, parcelas, datas e mais. Grátis.</span>
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3 focus:bg-muted/70">
                <Link to="/links-temporarios" className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Link2 className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">Link temporário</span>
                    <span className="block text-xs text-muted-foreground">Compartilhe algo que some sozinho.</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/sobre" className={classeLink}>
            Sobre
            {sublinhado}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SeletorIdioma />
          <Button
            asChild
            size="sm"
            className={`h-8 rounded-full px-4 text-sm font-medium shadow-none transition-colors duration-150 motion-reduce:transition-none sm:h-9 ${foco}`}
          >
            <Link to="/entrar">
              Entrar <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-full text-foreground/80 hover:bg-muted/70 hover:text-foreground lg:hidden ${foco}`}
                aria-label={aberto ? "Fechar menu" : "Abrir menu"}
                aria-expanded={aberto}
                aria-controls="menu-celular"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              id="menu-celular"
              side="top"
              aria-describedby={undefined}
              className="inset-0 flex h-dvh w-full flex-col gap-0 border-0 bg-background/90 p-0 shadow-none backdrop-blur-2xl backdrop-saturate-150 data-[state=closed]:duration-200 data-[state=open]:duration-300 motion-reduce:animate-none supports-[backdrop-filter]:bg-background/80 [&>button]:hidden"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-12 shrink-0 items-center justify-between px-4 sm:h-14">
                <span className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
                  <BrandMark className="size-7 rounded-lg" />
                  <span>
                    Control<span className="text-primary">ALL</span>
                  </span>
                </span>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`size-9 rounded-full text-foreground/80 hover:bg-muted/70 hover:text-foreground ${foco}`}
                    aria-label="Fechar menu"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </Button>
                </SheetClose>
              </div>
              <nav
                className="flex-1 overflow-y-auto px-6 pb-6 pt-4 animate-in fade-in-0 slide-in-from-top-2 duration-500 motion-reduce:animate-none"
                aria-label="Menu do site"
              >
                <div className="grid gap-0.5">
                  {links.map((l) => (
                    <a key={l.href} href={l.href} onClick={fechar} className={classeLinkCelular}>
                      {l.rotulo}
                    </a>
                  ))}
                  <Link to="/sobre" onClick={fechar} className={classeLinkCelular}>
                    Sobre o Control ALL
                  </Link>
                </div>
                <p className="mt-8 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ferramentas grátis</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to="/calculadoras"
                    onClick={fechar}
                    className={`flex flex-col gap-2 rounded-2xl bg-muted/60 p-4 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-muted motion-reduce:transition-none ${foco}`}
                  >
                    <Calculator className="size-5 text-primary" aria-hidden="true" /> Calculadoras
                  </Link>
                  <Link
                    to="/links-temporarios"
                    onClick={fechar}
                    className={`flex flex-col gap-2 rounded-2xl bg-muted/60 p-4 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-muted motion-reduce:transition-none ${foco}`}
                  >
                    <Link2 className="size-5 text-primary" aria-hidden="true" /> Link temporário
                  </Link>
                </div>
                <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 px-2 text-sm text-muted-foreground">
                  <Link to="/termos-de-uso" onClick={fechar} className={`rounded hover:text-foreground ${foco}`}>Termos</Link>
                  <Link to="/privacidade" onClick={fechar} className={`rounded hover:text-foreground ${foco}`}>Privacidade</Link>
                  <Link to="/cookies" onClick={fechar} className={`rounded hover:text-foreground ${foco}`}>Cookies</Link>
                </div>
              </nav>
              <div className="grid shrink-0 gap-2 border-t border-border/60 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button asChild size="lg" className={`h-12 rounded-full text-base font-semibold ${foco}`}>
                  <Link to="/entrar" search={{ criar: true }} onClick={fechar}>
                    Criar minha conta grátis <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className={`h-12 rounded-full bg-transparent text-base ${foco}`}>
                  <Link to="/entrar" onClick={fechar}>
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
