import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { lerEscolha, type EscolhaInicio } from "@/lib/modelos-inicio";

/**
 * 18/11/2026: modelo do Início escolhido pela pessoa, o MESMO do app (preferencias_usuario.inicio_modelo).
 * Cada pessoa tem a sua escolha, também no workspace conjunto. Sem a coluna (SQL pendente), vale no navegador.
 */
const CHAVE_LOCAL = "controlall:inicio-modelo";

function lerLocal(): EscolhaInicio | null {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL);
    return raw ? lerEscolha(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function useEscolhaInicio(): { escolha: EscolhaInicio; salvar: (e: EscolhaInicio) => void; carregado: boolean } {
  const { user } = useSession();
  const qc = useQueryClient();
  const chave = ["inicio-modelo", user?.id];
  const q = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("preferencias_usuario")
        .select("inicio_modelo")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error || !data?.inicio_modelo) return lerLocal() ?? lerEscolha(null);
      return lerEscolha(data.inicio_modelo);
    },
  });
  const m = useMutation({
    mutationFn: async (e: EscolhaInicio) => {
      try {
        localStorage.setItem(CHAVE_LOCAL, JSON.stringify(e));
      } catch {
        // navegador sem armazenamento: segue só com a conta
      }
      const { error } = await (supabase as any)
        .from("preferencias_usuario")
        .upsert({ user_id: user!.id, inicio_modelo: e }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: (e) => qc.setQueryData(chave, e),
  });
  const salvar = useCallback((e: EscolhaInicio) => m.mutate(e), [m]);
  return { escolha: (q.data as EscolhaInicio | undefined) ?? lerEscolha(null), salvar, carregado: q.isFetched };
}
