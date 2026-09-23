// Substituídos em tempo de build pelo `define` em vite.config.ts.
declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;

/**
 * Selo fixo no topo da tela com o commit/hash com que este build foi
 * compilado. Existe só pra dar pra conferir visualmente, sem adivinhar, se
 * o site que você está testando já reflete o último `git push` — antes
 * disso, um "não funcionou ainda" podia tanto ser um bug de verdade quanto
 * o navegador ainda rodando um build antigo.
 *
 * "-dev" no final do hash quer dizer que havia mudanças não commitadas no
 * repositório no momento do build (ex. rodou `bun run dev` sem commitar
 * antes). "sem-git" aparece só se o build rodou num lugar sem `.git`
 * disponível (não deveria acontecer no seu ambiente normal).
 */
export function VersaoBuild() {
  const sincronizar = useServerFn(sincronizarVersaoSite);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session)
        void sincronizar({
          data: { versao: __APP_VERSION__, buildEm: new Date(__APP_BUILD_TIME__).toISOString() },
        });
    });
  }, [sincronizar]);
  return null;
}
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sincronizarVersaoSite } from "@/lib/comunicados.functions";
