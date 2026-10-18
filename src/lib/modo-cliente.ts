import { useSyncExternalStore } from "react";

/**
 * "Ver como cliente": só o admin do site pode ativar. Esconde no menu e nas telas
 * os itens administrativos para conferir a experiência de um cliente comum.
 * Não altera permissões: quem decide acesso continua sendo o servidor.
 * Fica em sessionStorage (vale só nesta aba, some ao fechá-la).
 */
const CHAVE = "modo-cliente";
const ouvintes = new Set<() => void>();

function ler(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

export function definirModoCliente(ativo: boolean): void {
  try {
    if (ativo) window.sessionStorage.setItem(CHAVE, "1");
    else window.sessionStorage.removeItem(CHAVE);
  } catch {
    // Sem sessionStorage (navegação privada bloqueada): segue só em memória.
  }
  ouvintes.forEach((cb) => cb());
}

function assinar(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

export function useModoCliente(): boolean {
  return useSyncExternalStore(assinar, ler, () => false);
}
