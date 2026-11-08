import { useQuery, useQueryClient } from "@tanstack/react-query";
import { definirViradaDoGrupo } from "@/lib/format";
import { buscarRegraCiclo, salvarRegraCiclo, type EstadoRegraCiclo } from "@/lib/regra-ciclo";
import { useProfile, useSession } from "./useAuthData";

export const CHAVE_REGRA_CICLO = ["regra-ciclo-grupo"] as const;

/**
 * Regra do ciclo do grupo (08/11/2026). Aplica o dia D no cálculo global (format.ts) antes de a tela
 * receber o resultado. `disponivel` false = migration pendente (segue a virada antiga, sem assistente).
 */
export function useRegraCiclo() {
  const { user } = useSession();
  const query = useQuery<EstadoRegraCiclo>({
    queryKey: [...CHAVE_REGRA_CICLO, user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      try {
        const estado = await buscarRegraCiclo();
        definirViradaDoGrupo(estado.regra?.dia_virada ?? null);
        return estado;
      } catch {
        definirViradaDoGrupo(null);
        return { disponivel: false, regra: null };
      }
    },
  });
  return {
    disponivel: query.data?.disponivel ?? false,
    regra: query.data?.regra ?? null,
    carregado: query.isSuccess || query.isError || !user?.id,
  };
}

/** Salva a regra do grupo e refaz os cálculos. */
export function useSalvarRegraCiclo() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  return async (dia: number) => {
    await salvarRegraCiclo(dia, (profile as any)?.grupo_id ?? null);
    definirViradaDoGrupo(dia);
    await qc.invalidateQueries({ queryKey: CHAVE_REGRA_CICLO });
  };
}
