import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { appSupabase } from "@/integrations/supabase/app-types";
import { useProfile } from "@/hooks/useAuthData";

export function useReceitas() {
  return useQuery({
    queryKey: ["receitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receitas")
        .select("*")
        .order("data_recebimento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDespesas() {
  return useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, parcelas(*), cartoes(apelido, titular, final, cor), bancos(nome)")
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useParcelas() {
  return useQuery({
    queryKey: ["parcelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, despesas(descricao, categoria, tipo, moeda)")
        .order("vencimento");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCartoes() {
  return useQuery({
    queryKey: ["cartoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes")
        .select("*, bancos(nome)")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBancos() {
  return useQuery({
    queryKey: ["bancos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bancos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCategorias(tipo: "receita" | "despesa") {
  return useQuery({
    queryKey: ["categorias", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .eq("tipo", tipo)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvestimentos() {
  return useQuery({
    queryKey: ["investimentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investimentos")
        .select("*, investimento_movimentos(*)")
        .order("data_investimento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVeiculos() {
  return useQuery({
    queryKey: ["veiculos"],
    queryFn: async () => {
      const { data, error } = await appSupabase
        .from("veiculos")
        .select("*, veiculo_documentos(*), veiculo_eventos(*)")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProfilesList() {
  const { data: meuPerfil } = useProfile();
  return useQuery({
    queryKey: ["profiles-list", meuPerfil?.grupo_id],
    enabled: !!meuPerfil?.grupo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("grupo_id", meuPerfil!.grupo_id!)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRolesList() {
  const { data: perfis = [] } = useProfilesList();
  const ids = perfis.map((perfil) => perfil.id);
  return useQuery({
    queryKey: ["roles-list", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").in("user_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFaturasImportadas() {
  return useQuery({
    queryKey: ["import-faturas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_faturas")
        .select("*")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const RESPONSAVEIS_EXTRA = "Casal / Compartilhado";
