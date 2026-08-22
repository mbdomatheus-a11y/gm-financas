import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useProfilesList() {
  return useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRolesList() {
  return useQuery({
    queryKey: ["roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const RESPONSAVEIS_EXTRA = "Casal / Compartilhado";
