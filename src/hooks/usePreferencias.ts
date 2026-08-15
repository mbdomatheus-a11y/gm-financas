import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./useAuthData";

export type Preferencias = {
  user_id: string;
  tema: string;
  paleta: string;
  fonte: string;
  layout_menu: string;
};

export const DEFAULT_PREFS: Omit<Preferencias, "user_id"> = {
  tema: "claro",
  paleta: "azul",
  fonte: "Plus Jakarta Sans",
  layout_menu: "lateral",
};

export function usePreferencias() {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["preferencias", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preferencias_usuario")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Preferencias | null) ?? { user_id: user!.id, ...DEFAULT_PREFS };
    },
  });

  const save = useMutation({
    mutationFn: async (values: Partial<Omit<Preferencias, "user_id">>) => {
      const next = { ...DEFAULT_PREFS, ...(query.data ?? {}), ...values, user_id: user!.id };
      const { error } = await supabase.from("preferencias_usuario").upsert(next);
      if (error) throw error;
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferencias"] }),
  });

  return { prefs: query.data ?? { user_id: "", ...DEFAULT_PREFS }, save };
}

export function useApplyPreferencias() {
  const { prefs } = usePreferencias();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-palette", prefs.paleta);
    root.style.setProperty("--app-font", `"${prefs.fonte}"`);

    const apply = (dark: boolean) => root.classList.toggle("dark", dark);
    if (prefs.tema === "automatico") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const listener = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
    apply(prefs.tema === "escuro");
    return;
  }, [prefs.paleta, prefs.fonte, prefs.tema]);
}
