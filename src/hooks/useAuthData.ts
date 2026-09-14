import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some((r) => r.role === "admin");
    },
  });
}

export type Modulo =
  | "receitas"
  | "despesas"
  | "cartoes"
  | "investimentos"
  | "veiculos"
  | "compartilhar"
  | "personalizacao";

export function usePermissoes() {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin();
  const query = useQuery({
    queryKey: ["permissoes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("permissoes").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const can = (modulo: Modulo, acao: "ver" | "editar" | "excluir" = "ver") => {
    if (isAdmin) return true;
    const row = query.data?.find((p) => p.modulo === modulo);
    if (!row) return acao !== "excluir";
    if (acao === "ver") return row.pode_ver;
    if (acao === "editar") return row.pode_editar;
    return row.pode_excluir;
  };

  return { ...query, can, isAdmin: !!isAdmin };
}
