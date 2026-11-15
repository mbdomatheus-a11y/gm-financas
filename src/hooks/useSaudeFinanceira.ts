import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { useNumerosCiclo } from "@/hooks/useNumerosCiclo";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { calcularSaude, type EntradasSaude, type SaudeFinanceira } from "@/lib/saude-financeira";

type DadosBanco = Pick<EntradasSaude, "guardado" | "contasVencidas" | "contasPagas" | "cartaoEmAberto" | "cartaoLimite" | "diasComRegistro14">;

/**
 * Saúde financeira (15/11/2026): números do ciclo (numeros-ciclo.ts) + o que só o banco sabe
 * (meus_dados_saude). Regra única em lib/saude-financeira.ts, igual no app. Guarda a melhor nota para
 * as conquistas da Minha jornada.
 */
export function useSaudeFinanceira(): { saude: SaudeFinanceira | null; carregando: boolean } {
  const { user } = useSession();
  const qc = useQueryClient();
  const mes = useCompetenciaVigente();
  const numeros = useNumerosCiclo(mes);

  const banco = useQuery({
    queryKey: ["saude-financeira", user?.id, numeros.inicio, numeros.hoje],
    enabled: !!user?.id && !!numeros.inicio,
    staleTime: 60_000,
    queryFn: async (): Promise<DadosBanco | null> => {
      const { data, error } = await (supabase as any).rpc("meus_dados_saude", { p_inicio: numeros.inicio, p_hoje: numeros.hoje });
      if (error || !data) return null;
      return data as DadosBanco;
    },
  });

  const saude = useMemo(() => {
    if (!banco.data) return null;
    const d = banco.data;
    return calcularSaude({
      receitasCiclo: numeros.previsto.receitas,
      sobraPrevista: numeros.previsto.sobra,
      despesasCiclo: numeros.previsto.despesas,
      diasNoCiclo: numeros.diasNoCiclo,
      saldoHoje: numeros.real.sobra,
      guardado: Number(d.guardado) || 0,
      contasVencidas: Number(d.contasVencidas) || 0,
      contasPagas: Number(d.contasPagas) || 0,
      cartaoEmAberto: Number(d.cartaoEmAberto) || 0,
      cartaoLimite: Number(d.cartaoLimite) || 0,
      diasComRegistro14: Number(d.diasComRegistro14) || 0,
    });
  }, [banco.data, numeros]);

  const registrada = useRef(-1);
  useEffect(() => {
    if (!saude || saude.semDados || saude.nota <= registrada.current) return;
    registrada.current = saude.nota;
    void (supabase as any)
      .rpc("registrar_saude", { p_nota: saude.nota })
      .then(() => qc.invalidateQueries({ queryKey: ["jornada"] }));
  }, [saude, qc]);

  return { saude, carregando: banco.isLoading };
}
