import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Aplica no navegador a redefinição de avisos pedida pelo admin (28/10/2026).
 * Compara a data do último pedido (do usuário ou para todos) com a última aplicada neste navegador
 * e, se for nova, apaga o "já vi / não mostrar mais" guardado aqui e recarrega a página uma vez.
 */
const CHAVES_FIXAS = [
  "control-all-aviso-privacidade",
  "control-all-aviso-privacidade-rodada",
  "control-all-convite-dispensado-rodada",
  "financas_aviso_pluggy_fechado",
  "control-all.instalar-dispensado-em",
  "control-all.primeiros-passos-adiado",
];
const PREFIXOS_LOCAIS = ["fechamento-adiado-"];
const PREFIXOS_SESSAO = ["control-all-convite-visto-sessao", "control-all-aviso-beta-", "comunicado-dispensado-sessao:"];

function limparAvisosDoNavegador(userId: string) {
  const chaves = [...CHAVES_FIXAS, `control-all-primeira-fatura-${userId}`, `control-all-depara-aviso-${userId}`];
  for (const k of chaves) localStorage.removeItem(k);
  for (const k of Object.keys(localStorage)) if (PREFIXOS_LOCAIS.some((p) => k.startsWith(p))) localStorage.removeItem(k);
  for (const k of Object.keys(sessionStorage)) if (PREFIXOS_SESSAO.some((p) => k.startsWith(p))) sessionStorage.removeItem(k);
}

export function useAplicarRedefinicaoAvisos(userId: string | null | undefined) {
  const qc = useQueryClient();
  const { data: ultima } = useQuery({
    queryKey: ["avisos-redefinicao", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("avisos_redefinicoes")
        .select("criado_em")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.criado_em as string | undefined) ?? null;
    },
  });
  useEffect(() => {
    if (!userId || !ultima) return;
    try {
      const marca = `control-all-avisos-redefinidos:${userId}`;
      const aplicada = localStorage.getItem(marca);
      if (aplicada && new Date(aplicada).getTime() >= new Date(ultima).getTime()) return;
      limparAvisosDoNavegador(userId);
      localStorage.setItem(marca, ultima);
      void qc.invalidateQueries({ queryKey: ["aviso-dispensado"] });
      window.location.reload();
    } catch {
      // sem armazenamento no navegador: nada guardado para limpar
    }
  }, [userId, ultima, qc]);
}
