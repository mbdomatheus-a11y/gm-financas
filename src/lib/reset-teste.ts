import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Reset de conta de teste (Administração > Usuários > Contas de teste).
 * Quando a conta foi resetada, ela volta a contar como conta nova a partir da data do reset, e o que
 * este navegador guardou sobre ela (avisos vistos, primeira fatura) é limpo uma vez.
 * Só as contas de teste têm valor aqui; para as demais a função devolve null e nada muda.
 */
const chaveVisto = (userId: string) => `control-all.reset-teste.${userId}`;

export async function sincronizarResetTeste(userId: string): Promise<string | null> {
  try {
    const { data, error } = await (supabase as any).rpc("meu_ultimo_reset_teste");
    if (error || !data) return null;
    const iso = String(data);
    try {
      if (localStorage.getItem(chaveVisto(userId)) !== iso) {
        const apagar: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes(userId) && !k.startsWith("sb-")) apagar.push(k);
        }
        apagar.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(chaveVisto(userId), iso);
      }
    } catch {
      // sem armazenamento local: segue só com a data
    }
    return iso;
  } catch {
    return null;
  }
}

/** Data do último reset de teste da conta logada (null para contas comuns). */
export function useResetTeste(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["reset-teste", userId],
    queryFn: () => sincronizarResetTeste(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
