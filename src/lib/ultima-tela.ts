import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";

/**
 * Voltar para a última tela (31/10/2026, pedido do Matheus, igual ao app): o site guarda a tela em que a
 * pessoa está e, ao abrir de novo (nova aba, app instalado, depois do login), volta para ela em vez da
 * tela de abertura. Guardado por usuário neste navegador; vale por 30 dias.
 */
const chave = (uid: string) => `control-all.ultima-tela.${uid}`;
const RESTAURADA = "control-all.ultima-tela-restaurada";
const VALIDADE_MS = 30 * 86_400_000;
/** Telas onde o site cai ao abrir ou depois do login: só delas é que se volta para a última tela. */
const TELAS_DE_ABERTURA = new Set(["/inicio", "/dashboard", "/lista-compras", "/notas"]);
const NAO_GUARDAR = [/^\/nova-senha/, /^\/evento\//];

export function useUltimaTela(uid: string | undefined) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });

  // 1) Uma vez por aba: se abriu numa tela de abertura, vai para a última tela.
  useEffect(() => {
    if (!uid) return;
    try {
      if (sessionStorage.getItem(RESTAURADA)) return;
      sessionStorage.setItem(RESTAURADA, "1");
      if (!TELAS_DE_ABERTURA.has(pathname)) return;
      const salvo = JSON.parse(localStorage.getItem(chave(uid)) ?? "null") as { href?: string; em?: number } | null;
      if (!salvo?.href || !salvo.em || Date.now() - salvo.em > VALIDADE_MS) return;
      if (!salvo.href.startsWith("/") || salvo.href.startsWith("//")) return;
      if (salvo.href.split("?")[0] === pathname) return;
      router.history.replace(salvo.href);
    } catch {
      /* navegador sem armazenamento: abre normal */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // 2) Guarda a tela atual a cada navegação.
  useEffect(() => {
    if (!uid || NAO_GUARDAR.some((r) => r.test(pathname))) return;
    try {
      localStorage.setItem(chave(uid), JSON.stringify({ href, em: Date.now() }));
    } catch {
      /* ignora */
    }
  }, [uid, href, pathname]);
}
