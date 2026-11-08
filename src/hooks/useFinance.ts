import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { appSupabase } from "@/integrations/supabase/app-types";
import { useProfile } from "@/hooks/useAuthData";
import { buscarTudo } from "@/lib/buscar-tudo";

export function useReceitas() {
  return useQuery({
    queryKey: ["receitas"],
    queryFn: async () => {
      return buscarTudo(() =>
        supabase.from("receitas").select("cartao_id,categoria,congelada,created_at,created_by,data_recebimento,descricao,frequencia,grupo_id,id,importada_em,moeda,observacoes,origem,pluggy_transaction_id,possivel_duplicidade,reajuste_indice,reajuste_inicio,reajuste_modo,reajuste_percentual,reajuste_periodicidade,reajuste_valor_fixo,recorrencia_inicio,recorrencia_meses,recorrencia_sem_prazo,recorrente,responsavel,updated_at,valor").order("data_recebimento", { ascending: false }).order("id"),
      );
    },
  });
}

export function useDespesas() {
  return useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      return buscarTudo(() =>
        supabase
          .from("despesas")
          .select("banco_id,banco_nome,cartao_final,cartao_id,categoria,categoria_confirmada,categoria_sugerida,confianca_categoria,congelada,created_at,created_by,data_compra,data_primeira_parcela,dedup_key,descricao,descricao_normalizada,direcao,economia_conquistada,estabelecimento,estabelecimento_normalizado,fatura_id,grupo_id,id,importada_em,iof,moeda,observacoes,origem,pluggy_grupo,pluggy_transaction_id,possivel_duplicidade,reajuste_indice,reajuste_inicio,reajuste_percentual,reajuste_periodicidade,recorrencia_inicio,recorrencia_meses,recorrencia_sem_prazo,regra_id,responsavel,subcategoria,tipo,total_parcelas,updated_at,valor_total,valor_total_centavos, parcelas(confianca_data,created_at,data_pagamento,dedup_key,despesa_id,fatura_id,grupo_id,id,moeda,numero,origem,paga,situacao_temporal,total,updated_at,valor,valor_estimado,vencimento), cartoes(apelido, titular, final, cor), bancos(nome)")
          .order("data_compra", { ascending: false })
          .order("id"),
      );
    },
  });
}

export function useParcelas() {
  return useQuery({
    queryKey: ["parcelas"],
    queryFn: async () => {
      return buscarTudo(() =>
        supabase.from("parcelas").select("*, despesas(descricao, categoria, tipo, moeda)").order("vencimento").order("id"),
      );
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
        .select("ativo,cpf,created_at,email,foto_url,grupo_id,grupo_secundario_id,id,nome,senha_temporaria")
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
        .select("arquivo_excluido_em,arquivo_excluido_por,arquivo_hash,arquivo_nome,banco,cartao_id,competencia,created_at,diferenca_validacao,fechada_em,grupo_id,id,limite_disponivel,limite_total,limite_utilizado,lote_id,origem_arquivo,precisa_revisao,status,total_declarado,total_extraido,updated_at,vencimento")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFaturasMes() {
  return useQuery({
    queryKey: ["faturas-mes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fatura_mes").select("banco_id,cartao_id,competencia,concluida_por_importacao_em,created_at,created_by,data_limite,despesa_avulsa_id,fechada_em,grupo_id,id,inclui_parcelas,modo_calculo,status,tipo_lancamento,total_informado,total_real,updated_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const RESPONSAVEIS_EXTRA = "Casal / Compartilhado";
