import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { AvisoDispensavel } from "@/lib/avisos-dispensados";

const chaveLocal = (aviso: string, userId: string) => `control-all.aviso.${aviso}.${userId}`;

function lerLocal(aviso: string, userId: string): boolean {
  try {
    return localStorage.getItem(chaveLocal(aviso, userId)) === "1";
  } catch {
    return false;
  }
}

/**
 * "Já vi / dispensei" guardado na conta (tabela avisos_dispensados, vale em qualquer aparelho).
 * Se a migration 20261107151000_avisos_boas_vindas.sql ainda não rodou, a gravação falha em
 * silêncio e o localStorage segura o aviso neste navegador.
 */
export function useAvisoConta(aviso: AvisoDispensavel, userId: string | null | undefined) {
  const qc = useQueryClient();
  const chave = ["aviso-conta", aviso, userId];
  const q = useQuery({
    queryKey: chave,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      if (userId && lerLocal(aviso, userId)) return true;
      const { data, error } = await (supabase as any)
        .from("avisos_dispensados")
        .select("rodada")
        .eq("aviso", aviso)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  async function dispensar() {
    if (!userId) return;
    qc.setQueryData(chave, true);
    try {
      localStorage.setItem(chaveLocal(aviso, userId), "1");
    } catch {
      // sem storage: vale o que estiver na conta
    }
    try {
      await (supabase as any)
        .from("avisos_dispensados")
        .upsert(
          { user_id: userId, aviso, rodada: 1, dispensado_em: new Date().toISOString() },
          { onConflict: "user_id,aviso" },
        );
    } catch {
      // migration pendente: o localStorage segura
    }
  }

  return { dispensado: q.data ?? false, carregando: !!userId && q.isLoading, dispensar };
}
