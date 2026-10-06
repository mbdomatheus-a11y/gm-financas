import { createServerFn } from "@tanstack/react-start";

/**
 * Leitura pública (home, sem login) de quais módulos estão liberados no site,
 * para mostrar "Em breve" nos que ainda não foram habilitados. Só expõe o
 * nome técnico do módulo e se está habilitado globalmente.
 */
export const listarModulosPublicos = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("modulos_globais").select("modulo,habilitado");
  return ((data ?? []) as { modulo: string; habilitado: boolean }[]).map((m) => ({
    modulo: m.modulo,
    habilitado: !!m.habilitado,
  }));
});
