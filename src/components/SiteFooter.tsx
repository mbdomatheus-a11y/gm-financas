import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";
import { abrirPreferenciasCookies } from "@/components/AvisoPrivacidade";

/** Rodapé público (24/10/2026): colunas no computador, empilhado no celular. */
export function SiteFooter() {
  const classe = "text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-28 pt-12 sm:grid-cols-2 sm:pb-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Link to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
            <BrandMark className="size-9 rounded-xl" />
            <span>
              Control<span className="text-primary">ALL</span>
            </span>
          </Link>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            Suas finanças e sua casa, tudo num lugar só. No site e no app para iPhone.
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Produto</p>
          <nav className="grid gap-2" aria-label="Produto">
            <a href="/#recursos" className={classe}>Recursos</a>
            <a href="/#modulos" className={classe}>Módulos</a>
            <a href="/#precos" className={classe}>Preços</a>
            <Link to="/sobre" className={classe}>Sobre</Link>
          </nav>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Ferramentas grátis</p>
          <nav className="grid gap-2" aria-label="Ferramentas">
            <Link to="/calculadoras" className={classe}>Calculadoras</Link>
            <Link to="/links-temporarios" className={classe}>Link temporário</Link>
          </nav>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Privacidade</p>
          <nav className="grid gap-2" aria-label="Documentos">
            <Link to="/termos-de-uso" className={classe}>Termos de Uso</Link>
            <Link to="/privacidade" className={classe}>Política de Privacidade</Link>
            <Link to="/cookies" className={classe}>Política de Cookies</Link>
            <button type="button" onClick={abrirPreferenciasCookies} className={`${classe} text-left`}>
              Preferências de cookies
            </button>
          </nav>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Control ALL. Todos os direitos reservados.</p>
          <p>
            Contato:{" "}
            <a className="hover:text-foreground" href="mailto:contato@controlall.com.br">
              contato@controlall.com.br
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
