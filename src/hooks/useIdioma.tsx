import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { usePreferencias } from "@/hooks/usePreferencias";
import {
  IDIOMA_PADRAO,
  idiomaDoNavegador,
  idiomaValido,
  direcaoDoIdioma,
  type Idioma,
} from "@/lib/i18n/idiomas";
import { traduzir, type ChaveTraducao } from "@/lib/i18n/traducoes";

const CHAVE_LOCAL = "control-all.idioma";

type Contexto = {
  idioma: Idioma;
  /** true quando veio do navegador/país e o usuário ainda não escolheu. */
  automatico: boolean;
  definir: (i: Idioma) => void;
  t: (chave: ChaveTraducao) => string;
};

const IdiomaContexto = createContext<Contexto | null>(null);

function lerLocal(): Idioma | null {
  try {
    return idiomaValido(localStorage.getItem(CHAVE_LOCAL));
  } catch {
    return null;
  }
}

/**
 * Idioma do site. Começa pelo que o navegador informa (que segue o país do
 * aparelho), passa a valer o que o usuário escolher e isso fica salvo na conta
 * e no navegador, para valer já na próxima abertura, antes de a conta carregar.
 */
export function IdiomaProvider({ children }: { children: React.ReactNode }) {
  const { prefs, save } = usePreferencias();
  const [local, setLocal] = useState<Idioma | null>(() => lerLocal());
  const daConta = idiomaValido((prefs as { idioma?: unknown }).idioma);

  const idioma = daConta ?? local ?? idiomaDoNavegador();
  const automatico = !daConta && !local;

  // A conta manda: se o usuário trocou em outro aparelho, o navegador acompanha.
  useEffect(() => {
    if (daConta && daConta !== local) {
      setLocal(daConta);
      try {
        localStorage.setItem(CHAVE_LOCAL, daConta);
      } catch {
        /* navegador sem armazenamento: segue só nesta sessão */
      }
    }
  }, [daConta, local]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = idioma;
    document.documentElement.dir = direcaoDoIdioma(idioma);
  }, [idioma]);

  const definir = useCallback(
    (novo: Idioma) => {
      setLocal(novo);
      try {
        localStorage.setItem(CHAVE_LOCAL, novo);
      } catch {
        /* segue só nesta sessão */
      }
      if (prefs.user_id) save.mutate({ idioma: novo } as never);
    },
    [prefs.user_id, save],
  );

  const valor = useMemo<Contexto>(
    () => ({
      idioma,
      automatico,
      definir,
      t: (chave: ChaveTraducao) => traduzir(chave, idioma),
    }),
    [idioma, automatico, definir],
  );

  return <IdiomaContexto.Provider value={valor}>{children}</IdiomaContexto.Provider>;
}

/** Fora do provedor (ex.: páginas públicas), usa o idioma do navegador. */
export function useIdioma(): Contexto {
  const ctx = useContext(IdiomaContexto);
  const semProvedor = useMemo<Contexto>(() => {
    const i = lerLocal() ?? (typeof navigator !== "undefined" ? idiomaDoNavegador() : IDIOMA_PADRAO);
    return {
      idioma: i,
      automatico: true,
      definir: (novo: Idioma) => {
        try {
          localStorage.setItem(CHAVE_LOCAL, novo);
        } catch {
          /* ignora */
        }
        if (typeof location !== "undefined") location.reload();
      },
      t: (chave: ChaveTraducao) => traduzir(chave, i),
    };
  }, []);
  return ctx ?? semProvedor;
}
