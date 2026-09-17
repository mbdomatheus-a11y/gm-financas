import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type InvestimentoTable = Database["public"]["Tables"]["investimentos"];
type ListaComprasTable = Database["public"]["Tables"]["lista_compras"];

type InvestimentoFields = {
  percentual_rendimento: number | null;
  tipo_rendimento: "cdi" | "selic" | "ipca_mais" | "fixo" | null;
};

type ListaComprasFields = {
  aprovado_por: string[];
  aprovacoes_necessarias: number;
};

type VeiculoRow = {
  ano: number | null;
  chassi: string | null;
  created_at: string;
  created_by: string | null;
  data_compra: string | null;
  data_proxima_troca_oleo: string | null;
  data_vencimento_ipva: string | null;
  data_vencimento_seguro: string | null;
  id: string;
  km_atual: number | null;
  km_proxima_troca_oleo: number | null;
  marca: string | null;
  modelo: string | null;
  motorista_principal: string | null;
  nome: string;
  observacoes: string | null;
  placa: string | null;
  renavam: string | null;
  updated_at: string;
};

type VeiculoDocumentoRow = {
  created_at: string;
  criado_por: string | null;
  id: string;
  nome: string;
  storage_path: string;
  tipo: string;
  veiculo_id: string;
};

type VeiculoEventoRow = {
  criado_por: string | null;
  created_at: string;
  custo: number | null;
  data: string;
  descricao: string | null;
  grupo_id: string | null;
  id: string;
  km: number | null;
  tipo: string;
  veiculo_id: string;
};

type TableDefinition<Row, Insert, Update, Relationships extends readonly unknown[]> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type VeiculoTable = TableDefinition<
  VeiculoRow,
  Omit<VeiculoRow, "created_at" | "id" | "updated_at"> & {
    created_at?: string;
    id?: string;
    updated_at?: string;
  },
  Partial<VeiculoRow>,
  []
>;

type VeiculoDocumentoTable = TableDefinition<
  VeiculoDocumentoRow,
  Omit<VeiculoDocumentoRow, "created_at" | "id"> & { created_at?: string; id?: string },
  Partial<VeiculoDocumentoRow>,
  [
    {
      foreignKeyName: "veiculo_documentos_veiculo_id_fkey";
      columns: ["veiculo_id"];
      isOneToOne: false;
      referencedRelation: "veiculos";
      referencedColumns: ["id"];
    },
  ]
>;

type VeiculoEventoTable = TableDefinition<
  VeiculoEventoRow,
  Omit<VeiculoEventoRow, "created_at" | "grupo_id" | "id"> & {
    created_at?: string;
    grupo_id?: string | null;
    id?: string;
  },
  Partial<VeiculoEventoRow>,
  []
>;

type AppTables = Omit<
  Database["public"]["Tables"],
  "investimentos" | "lista_compras"
> & {
  investimentos: {
    Row: InvestimentoTable["Row"] & InvestimentoFields;
    Insert: InvestimentoTable["Insert"] & Partial<InvestimentoFields>;
    Update: InvestimentoTable["Update"] & Partial<InvestimentoFields>;
    Relationships: InvestimentoTable["Relationships"];
  };
  lista_compras: {
    Row: ListaComprasTable["Row"] & ListaComprasFields;
    Insert: ListaComprasTable["Insert"] & Partial<ListaComprasFields>;
    Update: ListaComprasTable["Update"] & Partial<ListaComprasFields>;
    Relationships: ListaComprasTable["Relationships"];
  };
  veiculo_eventos: VeiculoEventoTable;
  veiculo_documentos: VeiculoDocumentoTable;
  veiculos: VeiculoTable;
};

type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & { Tables: AppTables };
};

// The generated client still describes the previously linked backend. Keep the
// compatibility boundary here until Lovable reconnects and regenerates its types.
export const appSupabase = supabase as unknown as SupabaseClient<AppDatabase>;