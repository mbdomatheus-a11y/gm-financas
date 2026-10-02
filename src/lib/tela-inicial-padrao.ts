/**
 * Tela de abertura padrão (Item 1 da Frente 4, plano de 2026-10-02):
 * o admin do site escolhe pra qual módulo o login cai por padrão, em vez de
 * sempre ir pro seletor de módulos (`/inicio`). Compartilhado entre
 * `EntrarForm.tsx` e `entrar.tsx` — os 4 pontos onde o login redireciona.
 *
 * Observação aceita (fora de escopo resolver agora): se o admin escolher uma
 * tela cujo módulo esteja desabilitado para um usuário específico, essa
 * pessoa cai numa tela sem acesso — mesmo risco que já existe ao configurar
 * módulos globais, não uma regressão desta função.
 */
export const TELAS_INICIAIS = ["financas", "lista-compras", "notas"] as const;
export type TelaInicialPadrao = (typeof TELAS_INICIAIS)[number];

export const ROTULOS_TELA_INICIAL: Record<TelaInicialPadrao, string> = {
  financas: "Finanças (Dashboard)",
  "lista-compras": "Lista de compras",
  notas: "Notas fiscais",
};

export function rotaDaTelaInicial(tela: TelaInicialPadrao | null | undefined): string {
  switch (tela) {
    case "lista-compras":
      return "/lista-compras";
    case "notas":
      return "/notas";
    case "financas":
    default:
      return "/dashboard";
  }
}
