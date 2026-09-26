import { Link } from "@tanstack/react-router";

/**
 * Links para Termos de Uso e Aviso de Privacidade. Navegam pra página
 * própria (/termos-de-uso, /privacidade) porque a página de Privacidade
 * tem formulário de envio e consulta de solicitação — não cabe bem num
 * popup. O que importa é que essas páginas têm o mesmo <SiteHeader />
 * fixo no topo das outras páginas públicas, então o menu nunca some
 * (2026-09-26, terceira revisão: nem popup escondendo o menu, nem página
 * sem o menu padronizado).
 */
export function LegalDialogs({ compact = false }: { compact?: boolean }) {
  const classe = compact
    ? "underline underline-offset-4"
    : "text-sm text-muted-foreground hover:text-foreground";

  return (
    <>
      <Link to="/termos-de-uso" className={classe}>
        Termos{compact ? " de Uso" : ""}
      </Link>
      <Link to="/privacidade" className={classe}>
        Privacidade
      </Link>
    </>
  );
}
