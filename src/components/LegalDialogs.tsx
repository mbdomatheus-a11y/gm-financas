import { Link } from "@tanstack/react-router";

/**
 * Links para Termos de Uso e Aviso de Privacidade. Antes abriam um popup
 * (Dialog) sobre a página atual; a pedido do proprietário (2026-09-26),
 * agora navegam como qualquer outro link do site — igual a Recursos,
 * Módulos, Calculadoras, Demonstração e Preços na home — usando as páginas
 * reais `/termos-de-uso` e `/privacidade`. Abrem em nova aba pra não perder
 * o que a pessoa já preencheu num formulário (ex.: cadastro em `/entrar`).
 */
export function LegalDialogs({ compact = false }: { compact?: boolean }) {
  const classe = compact
    ? "underline underline-offset-4"
    : "text-sm text-muted-foreground hover:text-foreground";

  return (
    <>
      <Link to="/termos-de-uso" target="_blank" rel="noopener noreferrer" className={classe}>
        Termos{compact ? " de Uso" : ""}
      </Link>
      <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className={classe}>
        Privacidade
      </Link>
    </>
  );
}
