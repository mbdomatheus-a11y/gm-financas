import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { lerEscolha, type EscolhaInicio } from "@/lib/modelos-inicio";

/**
 * 18/11/2026: modelo do Início escolhido pela pessoa (preferencias_usuario.inicio_modelo, igual ao app).
 * "Sincronizar app e site" ligado (padrão): o site lê e grava na conta, o que muda num muda no outro.
 * Desligado: o site guarda a própria visão só neste navegador e não mexe na conta.
 */
const CHAVE_LOCAL = "controlall:inicio-modelo";
const CHAVE_SINC = "controlall:inicio-sincronizar";

function lerLocal(): EscolhaInicio | null {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL);
    return raw ? lerEscolha(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function gravarLocal(e: EscolhaInicio) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(e));
  } catch {
    // navegador sem armazenamento
  }
}
function lerSinc(): boolean {
  try {
    return localStorage.getItem(CHAVE_SINC) !== "0";
  } catch {
    return true;
  }
}

export function useEscolhaInicio(): {
  escolha: EscolhaInicio;
  salvar: (e: EscolhaInicio) => void;
  carregado: boolean;
  sincronizar: boolean;
  definirSincronizar: (v: boolean) => void;
} {
  const { user } = useSession();
  const qc = useQueryClient();
  const [sincronizar, setSinc] = useState<boolean>(() => (typeof window === "undefined" ? true : lerSinc()));
  const chave = ["inicio-modelo", user?.id, sincronizar];

  const gravarConta = async (e: EscolhaInicio) => {
    const { error } = await (supabase as any)
      .from("preferencias_usuario")
      .upsert({ user_id: user!.id, inicio_modelo: e }, { onConflict: "user_id" });
    if (error) throw error;
  };

  const q = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!sincronizar) return lerLocal() ?? lerEscolha(null);
      const { data, error } = await (supabase as any)
        .from("preferencias_usuario")
        .select("inicio_modelo")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error || !data?.inicio_modelo) return lerLocal() ?? lerEscolha(null);
      const e = lerEscolha(data.inicio_modelo);
      gravarLocal(e);
      return e;
    },
  });
  const m = useMutation({
    mutationFn: async (e: EscolhaInicio) => {
      gravarLocal(e);
      if (sincronizar) await gravarConta(e);
    },
    onMutate: (e) => qc.setQueryData(chave, e),
  });
  const salvar = useCallback((e: EscolhaInicio) => m.mutate(e), [m]);
  const escolha = (q.data as EscolhaInicio | undefined) ?? lerEscolha(null);

  const definirSincronizar = useCallback(
    (v: boolean) => {
      try {
        localStorage.setItem(CHAVE_SINC, v ? "1" : "0");
      } catch {
        // segue só nesta sessão
      }
      // Ao ligar, a visão deste navegador passa a valer também no app.
      if (v && user?.id) void gravarConta(escolha).catch(() => {});
      gravarLocal(escolha);
      qc.setQueryData(["inicio-modelo", user?.id, v], escolha);
      setSinc(v);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [escolha, user?.id],
  );

  return { escolha, salvar, carregado: q.isFetched, sincronizar, definirSincronizar };
}
