import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { appSupabase } from "@/integrations/supabase/app-types";
import { useServerFn } from "@tanstack/react-start";
import { listarModulosDisponiveis } from "@/lib/configuracoes-site.functions";

export type ModuloGlobal =
  "financas" | "lista" | "notas" | "calculadora" | "pet" | "onde_esta" | "veiculo" | "exames" | "links";
export function useModulosGlobais() {
  const listar = useServerFn(listarModulosDisponiveis);
  const query = useQuery({ queryKey: ["modulos-disponiveis"], queryFn: () => listar() });
  const habilitado = (modulo: ModuloGlobal) =>
    query.data?.find((x: any) => x.modulo === modulo)?.habilitado ?? true;
  // Liberado para todos os usuários (ignora o acesso extra do admin).
  const liberadoGeral = (modulo: ModuloGlobal) =>
    query.data?.find((x: any) => x.modulo === modulo)?.liberadoGeral ?? true;
  return { ...query, habilitado, liberadoGeral };
}

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

export function useIsSiteAdmin() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["is-site-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await appSupabase
        .from("site_admins")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
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
  | "personalizacao"
  | "importar";

/** Etapa D (plano-importacao-v2.md): os três tipos de dado que a tela
 * `/importar` pode gravar, controláveis individualmente por usuário além do
 * "Ver" genérico (que controla o acesso à tela como um todo). */
export type TipoImportacao = "lancamentos" | "parcelamentos" | "limite";

export function usePermissoes() {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin();
  const { data: isSiteAdmin } = useIsSiteAdmin();
  const { data: profile } = useProfile();
  const exclusaoBloqueada = profile?.cpf === "41412522803";
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
    if (acao === "excluir" && exclusaoBloqueada) return false;
    if (isAdmin) return true;
    const row = query.data?.find((p) => p.modulo === modulo);
    if (!row) return acao !== "excluir";
    if (acao === "ver") return row.pode_ver;
    if (acao === "editar") return row.pode_editar;
    return row.pode_excluir;
  };

  /** Etapa D: permissão granular por tipo de dado importado. Default
   * permissivo (igual ao `can` genérico) quando não existe linha — admin
   * continua sempre liberado. */
  const canImportar = (tipo: TipoImportacao) => {
    if (isAdmin) return true;
    const row = query.data?.find((p) => p.modulo === "importar");
    if (!row) return true;
    if (tipo === "lancamentos") return row.pode_importar_lancamentos;
    if (tipo === "parcelamentos") return row.pode_importar_parcelamentos;
    return row.pode_importar_limite;
  };

  return {
    ...query,
    can,
    canImportar,
    isAdmin: !!isAdmin,
    isSiteAdmin: !!isSiteAdmin,
    exclusaoBloqueada,
  };
}
