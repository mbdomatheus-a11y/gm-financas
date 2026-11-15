import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { type Jornada, type JornadaBruta, calcularJornada } from "@/lib/jornada";

/**
 * Minha jornada (gamificação leve e opcional). Lê a função minha_jornada() do banco; se ela ainda
 * não existir, devolve null e nada aparece na tela.
 */
export function useJornada() {
  const { user } = useSession();
  const qc = useQueryClient();
  const chave = ["jornada", user?.id];

  const query = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<JornadaBruta | null> => {
      const { data, error } = await (supabase as any).rpc("minha_jornada");
      if (error || !data) return null;
      return data as JornadaBruta;
    },
  });

  const definirVisivel = useMutation({
    mutationFn: async (visivel: boolean) => {
      const { error } = await (supabase as any).rpc("definir_jornada_visivel", { p_visivel: visivel });
      if (error) throw new Error(error.message);
      return visivel;
    },
    onMutate: async (visivel) => {
      const antes = qc.getQueryData<JornadaBruta | null>(chave);
      if (antes) qc.setQueryData(chave, { ...antes, visivel });
      return { antes };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(chave, ctx.antes);
      toast.error("Não foi possível salvar. Tente de novo.");
    },
  });

  const jornada: Jornada | null = query.data ? calcularJornada(query.data) : null;
  return { jornada, carregando: query.isLoading, definirVisivel };
}
