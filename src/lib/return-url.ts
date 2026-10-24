/**
 * URL de retorno pós-login (2026-10-04, correção de segurança/UX).
 *
 * Antes: o AppLayout gravava QUALQUER rota visitada em sessionStorage e o
 * login reaproveitava esse valor. Resultado: um usuário que entrava no mesmo
 * navegador logo depois do admin caía em `/administracao` (rota restrita), e a
 * chave nunca era apagada no logout.
 *
 * Agora: só rotas internas seguras são lembradas, rotas restritas ao admin
 * nunca são guardadas, e a chave é apagada no logout e após o uso.
 */
export const CHAVE_RETORNO = "control-all-return-url";

/** Rotas que exigem privilégio (não devem ser destino automático de login). */
const ROTAS_RESTRITAS = ["/administracao", "/usuarios", "/backup"];

export function urlRetornoSegura(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return null;
  // Auditoria 24/10: barra invertida e caracteres de controle (TAB etc.) viram "//site-externo"
  // no navegador. Recusa e confere que a URL resolvida continua no próprio site.
  if (/[\\\u0000-\u001f\u007f]/.test(url)) return null;
  try {
    const base = "https://controlall.local";
    if (new URL(url, base).origin !== base) return null;
  } catch {
    return null;
  }
  const caminho = url.split("?")[0]?.split("#")[0] ?? "";
  if (ROTAS_RESTRITAS.some((r) => caminho === r || caminho.startsWith(`${r}/`))) return null;
  if (caminho === "/entrar" || caminho === "/") return null;
  return url;
}

export function lembrarUrlRetorno(url: string): void {
  try {
    const segura = urlRetornoSegura(url);
    if (segura) sessionStorage.setItem(CHAVE_RETORNO, segura);
  } catch {
    // sessionStorage indisponível não impede a navegação.
  }
}

export function limparUrlRetorno(): void {
  try {
    sessionStorage.removeItem(CHAVE_RETORNO);
  } catch {
    // ignorado
  }
}

export function lerUrlRetorno(): string | null {
  try {
    return urlRetornoSegura(sessionStorage.getItem(CHAVE_RETORNO));
  } catch {
    return null;
  }
}
