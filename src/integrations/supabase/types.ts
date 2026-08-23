export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bancos: {
        Row: {
          agencia: string | null
          conta: string | null
          created_at: string
          id: string
          nome: string
          saldo_atual: number
          tipo_conta: string
          titular: string | null
        }
        Insert: {
          agencia?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome: string
          saldo_atual?: number
          tipo_conta?: string
          titular?: string | null
        }
        Update: {
          agencia?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome?: string
          saldo_atual?: number
          tipo_conta?: string
          titular?: string | null
        }
        Relationships: []
      }
      cartao_vinculos: {
        Row: {
          banco: string
          created_at: string
          final: string
          id: string
          profile_id: string | null
          responsavel: string
          updated_at: string
        }
        Insert: {
          banco: string
          created_at?: string
          final: string
          id?: string
          profile_id?: string | null
          responsavel: string
          updated_at?: string
        }
        Update: {
          banco?: string
          created_at?: string
          final?: string
          id?: string
          profile_id?: string | null
          responsavel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartao_vinculos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes: {
        Row: {
          apelido: string | null
          banco_id: string | null
          bandeira: string
          cor: string | null
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          final: string
          id: string
          limite: number | null
          tipo: string
          titular: string
          validade_ano: number | null
          validade_mes: number | null
        }
        Insert: {
          apelido?: string | null
          banco_id?: string | null
          bandeira?: string
          cor?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          final: string
          id?: string
          limite?: number | null
          tipo?: string
          titular: string
          validade_ano?: number | null
          validade_mes?: number | null
        }
        Update: {
          apelido?: string | null
          banco_id?: string | null
          bandeira?: string
          cor?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          final?: string
          id?: string
          limite?: number | null
          tipo?: string
          titular?: string
          validade_ano?: number | null
          validade_mes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "bancos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          cor: string | null
          created_at: string
          icone: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          banco_id: string | null
          banco_nome: string | null
          cartao_final: string | null
          cartao_id: string | null
          categoria: string
          created_at: string
          created_by: string | null
          data_compra: string
          data_primeira_parcela: string
          dedup_key: string | null
          descricao: string
          descricao_normalizada: string | null
          direcao: string
          fatura_id: string | null
          grupo_parcelamento: string | null
          id: string
          moeda: string
          observacoes: string | null
          origem: string
          responsavel: string | null
          tipo: string
          total_parcelas: number
          valor_total: number
        }
        Insert: {
          banco_id?: string | null
          banco_nome?: string | null
          cartao_final?: string | null
          cartao_id?: string | null
          categoria?: string
          created_at?: string
          created_by?: string | null
          data_compra: string
          data_primeira_parcela: string
          dedup_key?: string | null
          descricao: string
          descricao_normalizada?: string | null
          direcao?: string
          fatura_id?: string | null
          grupo_parcelamento?: string | null
          id?: string
          moeda?: string
          observacoes?: string | null
          origem?: string
          responsavel?: string | null
          tipo: string
          total_parcelas?: number
          valor_total: number
        }
        Update: {
          banco_id?: string | null
          banco_nome?: string | null
          cartao_final?: string | null
          cartao_id?: string | null
          categoria?: string
          created_at?: string
          created_by?: string | null
          data_compra?: string
          data_primeira_parcela?: string
          dedup_key?: string | null
          descricao?: string
          descricao_normalizada?: string | null
          direcao?: string
          fatura_id?: string | null
          grupo_parcelamento?: string | null
          id?: string
          moeda?: string
          observacoes?: string | null
          origem?: string
          responsavel?: string | null
          tipo?: string
          total_parcelas?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "bancos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "import_faturas"
            referencedColumns: ["id"]
          },
        ]
      }
      import_faturas: {
        Row: {
          arquivo_excluido_em: string | null
          arquivo_excluido_por: string | null
          arquivo_hash: string
          arquivo_nome: string
          banco: string
          competencia: string | null
          created_at: string
          id: string
          limite_disponivel: number | null
          limite_total: number | null
          limite_utilizado: number | null
          lote_id: string
          paginas: number | null
          status: string
          storage_path: string | null
          total_declarado: number | null
          total_extraido: number | null
          updated_at: string
          vencimento: string | null
        }
        Insert: {
          arquivo_excluido_em?: string | null
          arquivo_excluido_por?: string | null
          arquivo_hash: string
          arquivo_nome: string
          banco: string
          competencia?: string | null
          created_at?: string
          id?: string
          limite_disponivel?: number | null
          limite_total?: number | null
          limite_utilizado?: number | null
          lote_id: string
          paginas?: number | null
          status?: string
          storage_path?: string | null
          total_declarado?: number | null
          total_extraido?: number | null
          updated_at?: string
          vencimento?: string | null
        }
        Update: {
          arquivo_excluido_em?: string | null
          arquivo_excluido_por?: string | null
          arquivo_hash?: string
          arquivo_nome?: string
          banco?: string
          competencia?: string | null
          created_at?: string
          id?: string
          limite_disponivel?: number | null
          limite_total?: number | null
          limite_utilizado?: number | null
          lote_id?: string
          paginas?: number | null
          status?: string
          storage_path?: string | null
          total_declarado?: number | null
          total_extraido?: number | null
          updated_at?: string
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_faturas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "import_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_lotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          observacao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      investimento_movimentos: {
        Row: {
          created_at: string
          data: string
          id: string
          investimento_id: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          investimento_id: string
          tipo: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          investimento_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "investimento_movimentos_investimento_id_fkey"
            columns: ["investimento_id"]
            isOneToOne: false
            referencedRelation: "investimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      investimentos: {
        Row: {
          created_at: string
          data_investimento: string
          id: string
          instituicao: string | null
          nome: string
          observacoes: string | null
          rentabilidade: string | null
          responsavel: string | null
          tipo: string
          valor_atual: number
          valor_investido: number
        }
        Insert: {
          created_at?: string
          data_investimento: string
          id?: string
          instituicao?: string | null
          nome: string
          observacoes?: string | null
          rentabilidade?: string | null
          responsavel?: string | null
          tipo: string
          valor_atual?: number
          valor_investido?: number
        }
        Update: {
          created_at?: string
          data_investimento?: string
          id?: string
          instituicao?: string | null
          nome?: string
          observacoes?: string | null
          rentabilidade?: string | null
          responsavel?: string | null
          tipo?: string
          valor_atual?: number
          valor_investido?: number
        }
        Relationships: []
      }
      lista_compras: {
        Row: {
          categoria: string
          comprado: boolean
          comprado_em: string | null
          comprado_por: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          observacao: string | null
          quantidade: number
          updated_at: string
        }
        Insert: {
          categoria?: string
          comprado?: boolean
          comprado_em?: string | null
          comprado_por?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          observacao?: string | null
          quantidade?: number
          updated_at?: string
        }
        Update: {
          categoria?: string
          comprado?: boolean
          comprado_em?: string | null
          comprado_por?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          quantidade?: number
          updated_at?: string
        }
        Relationships: []
      }
      parcelas: {
        Row: {
          confianca_data: string | null
          data_pagamento: string | null
          dedup_key: string | null
          despesa_id: string
          fatura_id: string | null
          id: string
          moeda: string
          numero: number
          origem: string
          paga: boolean
          situacao_temporal: string | null
          total: number
          valor: number
          valor_estimado: boolean
          vencimento: string
        }
        Insert: {
          confianca_data?: string | null
          data_pagamento?: string | null
          dedup_key?: string | null
          despesa_id: string
          fatura_id?: string | null
          id?: string
          moeda?: string
          numero: number
          origem?: string
          paga?: boolean
          situacao_temporal?: string | null
          total: number
          valor: number
          valor_estimado?: boolean
          vencimento: string
        }
        Update: {
          confianca_data?: string | null
          data_pagamento?: string | null
          dedup_key?: string | null
          despesa_id?: string
          fatura_id?: string | null
          id?: string
          moeda?: string
          numero?: number
          origem?: string
          paga?: boolean
          situacao_temporal?: string | null
          total?: number
          valor?: number
          valor_estimado?: boolean
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "import_faturas"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes: {
        Row: {
          id: string
          modulo: string
          pode_editar: boolean
          pode_excluir: boolean
          pode_ver: boolean
          user_id: string
        }
        Insert: {
          id?: string
          modulo: string
          pode_editar?: boolean
          pode_excluir?: boolean
          pode_ver?: boolean
          user_id: string
        }
        Update: {
          id?: string
          modulo?: string
          pode_editar?: boolean
          pode_excluir?: boolean
          pode_ver?: boolean
          user_id?: string
        }
        Relationships: []
      }
      preferencias_usuario: {
        Row: {
          fonte: string
          layout_menu: string
          paleta: string
          tema: string
          updated_at: string
          user_id: string
        }
        Insert: {
          fonte?: string
          layout_menu?: string
          paleta?: string
          tema?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          fonte?: string
          layout_menu?: string
          paleta?: string
          tema?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          cpf: string
          created_at: string
          id: string
          nome: string
          senha_temporaria: boolean
        }
        Insert: {
          ativo?: boolean
          cpf: string
          created_at?: string
          id: string
          nome: string
          senha_temporaria?: boolean
        }
        Update: {
          ativo?: boolean
          cpf?: string
          created_at?: string
          id?: string
          nome?: string
          senha_temporaria?: boolean
        }
        Relationships: []
      }
      receitas: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          data_recebimento: string
          descricao: string
          frequencia: string | null
          id: string
          moeda: string
          observacoes: string | null
          recorrente: boolean
          responsavel: string | null
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data_recebimento: string
          descricao: string
          frequencia?: string | null
          id?: string
          moeda?: string
          observacoes?: string | null
          recorrente?: boolean
          responsavel?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          descricao?: string
          frequencia?: string | null
          id?: string
          moeda?: string
          observacoes?: string | null
          recorrente?: boolean
          responsavel?: string | null
          valor?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "comum"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "comum"],
    },
  },
} as const
