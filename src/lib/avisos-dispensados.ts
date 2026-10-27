import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AvisoDispensavel = "beta" | "convite";

/**
 * "Não mostrar mais" guardado na conta (27/10/2026), não no navegador: vale no site e no app, em
 * qualquer aparelho. Volta a aparecer só quando o admin dispara uma rodada nova do aviso.
 */
export function useAvisoDispensado(aviso: AvisoDispensavel) {
  const qc = useQueryClient();
  const chave = ["aviso-dispensado", aviso];
  const { data: rodadaDispensada, isLoading } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data } = await (supabase as any).from("avisos_dispensados").select("rodada").eq("aviso", aviso).maybeSingle();
      return (data?.rodada as number | undefined) ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });
  async function dispensar(rodada: number) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any)
      .from("avisos_dispensados")
      .upsert({ user_id: u.user.id, aviso, rodada, dispensado_em: new Date().toISOString() }, { onConflict: "user_id,aviso" });
    qc.setQueryData(chave, rodada);
  }
  return { rodadaDispensada: rodadaDispensada ?? 0, carregando: isLoading, dispensar };
}
