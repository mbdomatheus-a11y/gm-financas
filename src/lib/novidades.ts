import { useCallback, useEffect, useState } from "react";

/** Identificador da novidade mais recente. Troque ao publicar algo novo para a linha voltar a aparecer na Início. */
export const NOVIDADE_ATUAL = "2026-11-07";
export const NOVIDADE_TITULO = "Início reorganizada e novos atalhos em Finanças";

const CHAVE = "controlall:novidade-lida";

function ler(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

/** Indica se há novidade não lida (guardado só neste aparelho) e permite marcar como lida. */
export function useNovidadeNaoLida() {
  const [lida, setLida] = useState<string | null>(NOVIDADE_ATUAL);
  useEffect(() => setLida(ler()), []);
  const marcarLida = useCallback(() => {
    try {
      localStorage.setItem(CHAVE, NOVIDADE_ATUAL);
    } catch {
      // sem armazenamento: só não lembra
    }
    setLida(NOVIDADE_ATUAL);
  }, []);
  return { naoLida: lida !== NOVIDADE_ATUAL, marcarLida };
}
