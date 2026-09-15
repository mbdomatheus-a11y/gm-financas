export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connection_key_ciphertext?: string;
          connector_id?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bancos: {
        Row: {
          agencia: string | null;
          conta: string | null;
          created_at: string;
          grupo_id: string | null;
          id: string;
          nome: string;
          saldo_atual: number;
          tipo_conta: string;
          titular: string | null;
        };
        Insert: {
          agencia?: string | null;
          conta?: string | null;
          created_at?: string;
          grupo_id?: string | null;
          id?: string;
          nome: string;
          saldo_atual?: number;
          tipo_conta?: string;
          titular?: string | null;
        };
        Update: {
          agencia?: string | null;
          conta?: string | null;
          created_at?: string;
          grupo_id?: string | null;
          id?: string;
          nome?: string;
          saldo_atual?: number;
          tipo_conta?: string;
          titular?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bancos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      cartao_vinculos: {
        Row: {
          banco: string;
          created_at: string;
          final: string;
          grupo_id: string | null;
          id: string;
          profile_id: string | null;
          responsavel: string;
          updated_at: string;
        };
        Insert: {
          banco: string;
          created_at?: string;
          final: string;
          grupo_id?: string | null;
          id?: string;
          profile_id?: string | null;
          responsavel: string;
          updated_at?: string;
        };
        Update: {
          banco?: string;
          created_at?: string;
          final?: string;
          grupo_id?: string | null;
          id?: string;
          profile_id?: string | null;
          responsavel?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cartao_vinculos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cartao_vinculos_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cartoes: {
        Row: {
          apelido: string | null;
          banco_id: string | null;
          bandeira: string;
          cor: string | null;
          created_at: string;
          dia_fechamento: number | null;
          dia_vencimento: number | null;
          final: string;
          grupo_id: string | null;
          id: string;
          limite: number | null;
          tipo: string;
          titular: string;
          validade_ano: number | null;
          validade_mes: number | null;
        };
        Insert: {
          apelido?: string | null;
          banco_id?: string | null;
          bandeira?: string;
          cor?: string | null;
          created_at?: string;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          final: string;
          grupo_id?: string | null;
          id?: string;
          limite?: number | null;
          tipo?: string;
          titular: string;
          validade_ano?: number | null;
          validade_mes?: number | null;
        };
        Update: {
          apelido?: string | null;
          banco_id?: string | null;
          bandeira?: string;
          cor?: string | null;
          created_at?: string;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          final?: string;
          grupo_id?: string | null;
          id?: string;
          limite?: number | null;
          tipo?: string;
          titular?: string;
          validade_ano?: number | null;
          validade_mes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "cartoes_banco_id_fkey";
            columns: ["banco_id"];
            isOneToOne: false;
            referencedRelation: "bancos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cartoes_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      categoria_regras: {
        Row: {
          ativo: boolean;
          categoria: string;
          created_at: string;
          created_by: string | null;
          estabelecimento_normalizado: string;
          grupo_id: string | null;
          id: string;
          origem_arquivo: string | null;
          prioridade: number;
          subcategoria: string | null;
          texto_original: string | null;
          tipo_regra: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          categoria: string;
          created_at?: string;
          created_by?: string | null;
          estabelecimento_normalizado: string;
          grupo_id?: string | null;
          id?: string;
          origem_arquivo?: string | null;
          prioridade?: number;
          subcategoria?: string | null;
          texto_original?: string | null;
          tipo_regra?: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          categoria?: string;
          created_at?: string;
          created_by?: string | null;
          estabelecimento_normalizado?: string;
          grupo_id?: string | null;
          id?: string;
          origem_arquivo?: string | null;
          prioridade?: number;
          subcategoria?: string | null;
          texto_original?: string | null;
          tipo_regra?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categoria_regras_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias: {
        Row: {
          cor: string | null;
          created_at: string;
          grupo_id: string | null;
          icone: string | null;
          id: string;
          nome: string;
          tipo: string;
        };
        Insert: {
          cor?: string | null;
          created_at?: string;
          grupo_id?: string | null;
          icone?: string | null;
          id?: string;
          nome: string;
          tipo: string;
        };
        Update: {
          cor?: string | null;
          created_at?: string;
          grupo_id?: string | null;
          icone?: string | null;
          id?: string;
          nome?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      comprovantes: {
        Row: {
          arquivo_excluido_em: string | null;
          arquivo_excluido_por: string | null;
          arquivo_hash: string;
          arquivo_nome: string;
          confianca: string | null;
          created_at: string;
          created_by: string | null;
          data_transacao: string | null;
          descricao: string;
          descricao_normalizada: string | null;
          despesa_id: string | null;
          id: string;
          lote_id: string | null;
          metodo: string | null;
          moeda: string;
          ocr_texto: string | null;
          pagador: string | null;
          recebedor: string | null;
          receita_id: string | null;
          responsavel: string | null;
          status: string;
          storage_path: string | null;
          tipo: string;
          updated_at: string;
          valor: number;
        };
        Insert: {
          arquivo_excluido_em?: string | null;
          arquivo_excluido_por?: string | null;
          arquivo_hash: string;
          arquivo_nome: string;
          confianca?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_transacao?: string | null;
          descricao: string;
          descricao_normalizada?: string | null;
          despesa_id?: string | null;
          id?: string;
          lote_id?: string | null;
          metodo?: string | null;
          moeda?: string;
          ocr_texto?: string | null;
          pagador?: string | null;
          recebedor?: string | null;
          receita_id?: string | null;
          responsavel?: string | null;
          status?: string;
          storage_path?: string | null;
          tipo?: string;
          updated_at?: string;
          valor: number;
        };
        Update: {
          arquivo_excluido_em?: string | null;
          arquivo_excluido_por?: string | null;
          arquivo_hash?: string;
          arquivo_nome?: string;
          confianca?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_transacao?: string | null;
          descricao?: string;
          descricao_normalizada?: string | null;
          despesa_id?: string | null;
          id?: string;
          lote_id?: string | null;
          metodo?: string | null;
          moeda?: string;
          ocr_texto?: string | null;
          pagador?: string | null;
          recebedor?: string | null;
          receita_id?: string | null;
          responsavel?: string | null;
          status?: string;
          storage_path?: string | null;
          tipo?: string;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comprovantes_despesa_fk";
            columns: ["despesa_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comprovantes_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "import_lotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comprovantes_receita_id_fkey";
            columns: ["receita_id"];
            isOneToOne: false;
            referencedRelation: "receitas";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracoes_casal: {
        Row: {
          chave: string;
          grupo_id: string | null;
          updated_at: string;
          valor: string | null;
        };
        Insert: {
          chave: string;
          grupo_id?: string | null;
          updated_at?: string;
          valor?: string | null;
        };
        Update: {
          chave?: string;
          grupo_id?: string | null;
          updated_at?: string;
          valor?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "configuracoes_casal_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      convites: {
        Row: {
          criado_em: string;
          criado_por: string | null;
          email_convidado: string | null;
          expira_em: string;
          grupo_id: string;
          id: string;
          token: string;
          usado: boolean;
          usado_por: string | null;
        };
        Insert: {
          criado_em?: string;
          criado_por?: string | null;
          email_convidado?: string | null;
          expira_em?: string;
          grupo_id: string;
          id?: string;
          token?: string;
          usado?: boolean;
          usado_por?: string | null;
        };
        Update: {
          criado_em?: string;
          criado_por?: string | null;
          email_convidado?: string | null;
          expira_em?: string;
          grupo_id?: string;
          id?: string;
          token?: string;
          usado?: boolean;
          usado_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "convites_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_usado_por_fkey";
            columns: ["usado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      despesas: {
        Row: {
          banco_id: string | null;
          banco_nome: string | null;
          cartao_final: string | null;
          cartao_id: string | null;
          categoria: string;
          categoria_confirmada: boolean;
          categoria_sugerida: string | null;
          comprovante_id: string | null;
          confianca_categoria: string | null;
          cotacao_original: number | null;
          created_at: string;
          created_by: string | null;
          data_compra: string;
          data_primeira_parcela: string;
          dedup_key: string | null;
          descricao: string;
          descricao_normalizada: string | null;
          direcao: string;
          estabelecimento: string | null;
          estabelecimento_normalizado: string | null;
          fatura_id: string | null;
          grupo_id: string | null;
          grupo_parcelamento: string | null;
          id: string;
          iof: boolean;
          moeda: string;
          moeda_original: string | null;
          observacoes: string | null;
          origem: string;
          reajuste_indice: string | null;
          reajuste_inicio: string | null;
          reajuste_percentual: number | null;
          reajuste_periodicidade: string | null;
          recorrencia_inicio: string | null;
          recorrencia_meses: number | null;
          recorrencia_sem_prazo: boolean;
          regra_id: string | null;
          responsavel: string | null;
          subcategoria: string | null;
          subcategoria_sugerida: string | null;
          tipo: string;
          total_parcelas: number;
          updated_at: string;
          valor_original_centavos: number | null;
          valor_total: number;
          valor_total_centavos: number | null;
        };
        Insert: {
          banco_id?: string | null;
          banco_nome?: string | null;
          cartao_final?: string | null;
          cartao_id?: string | null;
          categoria?: string;
          categoria_confirmada?: boolean;
          categoria_sugerida?: string | null;
          comprovante_id?: string | null;
          confianca_categoria?: string | null;
          cotacao_original?: number | null;
          created_at?: string;
          created_by?: string | null;
          data_compra: string;
          data_primeira_parcela: string;
          dedup_key?: string | null;
          descricao: string;
          descricao_normalizada?: string | null;
          direcao?: string;
          estabelecimento?: string | null;
          estabelecimento_normalizado?: string | null;
          fatura_id?: string | null;
          grupo_id?: string | null;
          grupo_parcelamento?: string | null;
          id?: string;
          iof?: boolean;
          moeda?: string;
          moeda_original?: string | null;
          observacoes?: string | null;
          origem?: string;
          reajuste_indice?: string | null;
          reajuste_inicio?: string | null;
          reajuste_percentual?: number | null;
          reajuste_periodicidade?: string | null;
          recorrencia_inicio?: string | null;
          recorrencia_meses?: number | null;
          recorrencia_sem_prazo?: boolean;
          regra_id?: string | null;
          responsavel?: string | null;
          subcategoria?: string | null;
          subcategoria_sugerida?: string | null;
          tipo?: string;
          total_parcelas?: number;
          updated_at?: string;
          valor_original_centavos?: number | null;
          valor_total: number;
          valor_total_centavos?: number | null;
        };
        Update: {
          banco_id?: string | null;
          banco_nome?: string | null;
          cartao_final?: string | null;
          cartao_id?: string | null;
          categoria?: string;
          categoria_confirmada?: boolean;
          categoria_sugerida?: string | null;
          comprovante_id?: string | null;
          confianca_categoria?: string | null;
          cotacao_original?: number | null;
          created_at?: string;
          created_by?: string | null;
          data_compra?: string;
          data_primeira_parcela?: string;
          dedup_key?: string | null;
          descricao?: string;
          descricao_normalizada?: string | null;
          direcao?: string;
          estabelecimento?: string | null;
          estabelecimento_normalizado?: string | null;
          fatura_id?: string | null;
          grupo_id?: string | null;
          grupo_parcelamento?: string | null;
          id?: string;
          iof?: boolean;
          moeda?: string;
          moeda_original?: string | null;
          observacoes?: string | null;
          origem?: string;
          reajuste_indice?: string | null;
          reajuste_inicio?: string | null;
          reajuste_percentual?: number | null;
          reajuste_periodicidade?: string | null;
          recorrencia_inicio?: string | null;
          recorrencia_meses?: number | null;
          recorrencia_sem_prazo?: boolean;
          regra_id?: string | null;
          responsavel?: string | null;
          subcategoria?: string | null;
          subcategoria_sugerida?: string | null;
          tipo?: string;
          total_parcelas?: number;
          updated_at?: string;
          valor_original_centavos?: number | null;
          valor_total?: number;
          valor_total_centavos?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "despesas_banco_id_fkey";
            columns: ["banco_id"];
            isOneToOne: false;
            referencedRelation: "bancos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "cartoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_comprovante_id_fkey";
            columns: ["comprovante_id"];
            isOneToOne: false;
            referencedRelation: "comprovantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_fatura_id_fkey";
            columns: ["fatura_id"];
            isOneToOne: false;
            referencedRelation: "import_faturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      fatura_layouts: {
        Row: {
          acertos: number;
          ancora_fim: string | null;
          ancora_inicio: string | null;
          assinatura: string;
          banco: string | null;
          colunas: Json;
          created_at: string;
          created_by: string | null;
          emissor: string | null;
          formato_data: string | null;
          formato_valor: string | null;
          grupo_id: string | null;
          id: string;
          ultimo_uso: string;
          updated_at: string;
        };
        Insert: {
          acertos?: number;
          ancora_fim?: string | null;
          ancora_inicio?: string | null;
          assinatura: string;
          banco?: string | null;
          colunas?: Json;
          created_at?: string;
          created_by?: string | null;
          emissor?: string | null;
          formato_data?: string | null;
          formato_valor?: string | null;
          grupo_id?: string | null;
          id?: string;
          ultimo_uso?: string;
          updated_at?: string;
        };
        Update: {
          acertos?: number;
          ancora_fim?: string | null;
          ancora_inicio?: string | null;
          assinatura?: string;
          banco?: string | null;
          colunas?: Json;
          created_at?: string;
          created_by?: string | null;
          emissor?: string | null;
          formato_data?: string | null;
          formato_valor?: string | null;
          grupo_id?: string | null;
          id?: string;
          ultimo_uso?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fatura_layouts_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      fatura_mes: {
        Row: {
          banco_id: string | null;
          cartao_id: string | null;
          competencia: string;
          created_at: string;
          created_by: string | null;
          despesa_avulsa_id: string | null;
          fechada_em: string | null;
          grupo_id: string | null;
          id: string;
          inclui_parcelas: boolean;
          status: string;
          total_informado: number;
          total_real: number | null;
          updated_at: string;
        };
        Insert: {
          banco_id?: string | null;
          cartao_id?: string | null;
          competencia: string;
          created_at?: string;
          created_by?: string | null;
          despesa_avulsa_id?: string | null;
          fechada_em?: string | null;
          grupo_id?: string | null;
          id?: string;
          inclui_parcelas?: boolean;
          status?: string;
          total_informado?: number;
          total_real?: number | null;
          updated_at?: string;
        };
        Update: {
          banco_id?: string | null;
          cartao_id?: string | null;
          competencia?: string;
          created_at?: string;
          created_by?: string | null;
          despesa_avulsa_id?: string | null;
          fechada_em?: string | null;
          grupo_id?: string | null;
          id?: string;
          inclui_parcelas?: boolean;
          status?: string;
          total_informado?: number;
          total_real?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fatura_mes_banco_id_fkey";
            columns: ["banco_id"];
            isOneToOne: false;
            referencedRelation: "bancos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fatura_mes_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "cartoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fatura_mes_despesa_avulsa_id_fkey";
            columns: ["despesa_avulsa_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fatura_mes_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      grupos: {
        Row: {
          criado_em: string;
          criado_por: string | null;
          id: string;
          nome: string;
        };
        Insert: {
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
        };
        Update: {
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      import_faturas: {
        Row: {
          arquivo_excluido_em: string | null;
          arquivo_excluido_por: string | null;
          arquivo_hash: string;
          arquivo_nome: string;
          banco: string;
          competencia: string | null;
          created_at: string;
          diferenca_validacao: number | null;
          fechada_em: string | null;
          grupo_id: string | null;
          id: string;
          limite_disponivel: number | null;
          limite_total: number | null;
          limite_utilizado: number | null;
          lote_id: string;
          origem_arquivo: string;
          paginas: number | null;
          precisa_revisao: boolean;
          status: string;
          storage_path: string | null;
          total_declarado: number | null;
          total_extraido: number | null;
          updated_at: string;
          vencimento: string | null;
        };
        Insert: {
          arquivo_excluido_em?: string | null;
          arquivo_excluido_por?: string | null;
          arquivo_hash: string;
          arquivo_nome: string;
          banco: string;
          competencia?: string | null;
          created_at?: string;
          diferenca_validacao?: number | null;
          fechada_em?: string | null;
          grupo_id?: string | null;
          id?: string;
          limite_disponivel?: number | null;
          limite_total?: number | null;
          limite_utilizado?: number | null;
          lote_id: string;
          origem_arquivo?: string;
          paginas?: number | null;
          precisa_revisao?: boolean;
          status?: string;
          storage_path?: string | null;
          total_declarado?: number | null;
          total_extraido?: number | null;
          updated_at?: string;
          vencimento?: string | null;
        };
        Update: {
          arquivo_excluido_em?: string | null;
          arquivo_excluido_por?: string | null;
          arquivo_hash?: string;
          arquivo_nome?: string;
          banco?: string;
          competencia?: string | null;
          created_at?: string;
          diferenca_validacao?: number | null;
          fechada_em?: string | null;
          grupo_id?: string | null;
          id?: string;
          limite_disponivel?: number | null;
          limite_total?: number | null;
          limite_utilizado?: number | null;
          lote_id?: string;
          origem_arquivo?: string;
          paginas?: number | null;
          precisa_revisao?: boolean;
          status?: string;
          storage_path?: string | null;
          total_declarado?: number | null;
          total_extraido?: number | null;
          updated_at?: string;
          vencimento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_faturas_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_faturas_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "import_lotes";
            referencedColumns: ["id"];
          },
        ];
      };
      import_lotes: {
        Row: {
          created_at: string;
          created_by: string | null;
          grupo_id: string | null;
          id: string;
          observacao: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          grupo_id?: string | null;
          id?: string;
          observacao?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          grupo_id?: string | null;
          id?: string;
          observacao?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_lotes_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      investimento_movimentos: {
        Row: {
          created_at: string;
          created_by: string | null;
          data: string;
          grupo_id: string | null;
          id: string;
          investimento_id: string;
          observacoes: string | null;
          tipo: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          data: string;
          grupo_id?: string | null;
          id?: string;
          investimento_id: string;
          observacoes?: string | null;
          tipo: string;
          valor: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          data?: string;
          grupo_id?: string | null;
          id?: string;
          investimento_id?: string;
          observacoes?: string | null;
          tipo?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "investimento_movimentos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investimento_movimentos_investimento_id_fkey";
            columns: ["investimento_id"];
            isOneToOne: false;
            referencedRelation: "investimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      investimentos: {
        Row: {
          created_at: string;
          created_by: string | null;
          data_aplicacao: string | null;
          data_investimento: string;
          grupo_id: string | null;
          id: string;
          instituicao: string | null;
          nome: string;
          observacoes: string | null;
          percentual_rendimento: number | null;
          rentabilidade: string | null;
          responsavel: string | null;
          tipo: string;
          tipo_rendimento: string | null;
          updated_at: string;
          valor_atual: number;
          valor_investido: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          data_aplicacao?: string | null;
          data_investimento?: string;
          grupo_id?: string | null;
          id?: string;
          instituicao?: string | null;
          nome: string;
          observacoes?: string | null;
          percentual_rendimento?: number | null;
          rentabilidade?: string | null;
          responsavel?: string | null;
          tipo?: string;
          tipo_rendimento?: string | null;
          updated_at?: string;
          valor_atual?: number;
          valor_investido?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          data_aplicacao?: string | null;
          data_investimento?: string;
          grupo_id?: string | null;
          id?: string;
          instituicao?: string | null;
          nome?: string;
          observacoes?: string | null;
          percentual_rendimento?: number | null;
          rentabilidade?: string | null;
          responsavel?: string | null;
          tipo?: string;
          tipo_rendimento?: string | null;
          updated_at?: string;
          valor_atual?: number;
          valor_investido?: number;
        };
        Relationships: [
          {
            foreignKeyName: "investimentos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      lista_compras: {
        Row: {
          alerta_em: string | null;
          aprovacoes_necessarias: number;
          aprovado_por: string[];
          categoria: string;
          comprado: boolean;
          comprado_em: string | null;
          comprado_por: string | null;
          created_at: string;
          created_by: string | null;
          grupo_id: string | null;
          id: string;
          lista: string;
          nome: string;
          observacao: string | null;
          quantidade: number;
          updated_at: string;
        };
        Insert: {
          alerta_em?: string | null;
          aprovacoes_necessarias?: number;
          aprovado_por?: string[];
          categoria?: string;
          comprado?: boolean;
          comprado_em?: string | null;
          comprado_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          grupo_id?: string | null;
          id?: string;
          lista?: string;
          nome: string;
          observacao?: string | null;
          quantidade?: number;
          updated_at?: string;
        };
        Update: {
          alerta_em?: string | null;
          aprovacoes_necessarias?: number;
          aprovado_por?: string[];
          categoria?: string;
          comprado?: boolean;
          comprado_em?: string | null;
          comprado_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          grupo_id?: string | null;
          id?: string;
          lista?: string;
          nome?: string;
          observacao?: string | null;
          quantidade?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lista_compras_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      nota_arquivos: {
        Row: {
          created_at: string;
          created_by: string | null;
          drive_file_id: string;
          id: string;
          link: string | null;
          mime_type: string | null;
          nome: string | null;
          nota_id: string;
          thumbnail_link: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          drive_file_id: string;
          id?: string;
          link?: string | null;
          mime_type?: string | null;
          nome?: string | null;
          nota_id: string;
          thumbnail_link?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          drive_file_id?: string;
          id?: string;
          link?: string | null;
          mime_type?: string | null;
          nome?: string | null;
          nota_id?: string;
          thumbnail_link?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nota_arquivos_nota_id_fkey";
            columns: ["nota_id"];
            isOneToOne: false;
            referencedRelation: "notas_fiscais";
            referencedColumns: ["id"];
          },
        ];
      };
      nota_itens: {
        Row: {
          created_at: string;
          descricao: string;
          garantia_fim: string | null;
          garantia_meses: number | null;
          id: string;
          nota_id: string;
          quantidade: number;
          valor_total: number;
          valor_unitario: number;
        };
        Insert: {
          created_at?: string;
          descricao: string;
          garantia_fim?: string | null;
          garantia_meses?: number | null;
          id?: string;
          nota_id: string;
          quantidade?: number;
          valor_total?: number;
          valor_unitario?: number;
        };
        Update: {
          created_at?: string;
          descricao?: string;
          garantia_fim?: string | null;
          garantia_meses?: number | null;
          id?: string;
          nota_id?: string;
          quantidade?: number;
          valor_total?: number;
          valor_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "nota_itens_nota_id_fkey";
            columns: ["nota_id"];
            isOneToOne: false;
            referencedRelation: "notas_fiscais";
            referencedColumns: ["id"];
          },
        ];
      };
      nota_vinculos: {
        Row: {
          created_at: string;
          created_by: string | null;
          despesa_id: string;
          id: string;
          nota_id: string;
          parcela_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          despesa_id: string;
          id?: string;
          nota_id: string;
          parcela_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          despesa_id?: string;
          id?: string;
          nota_id?: string;
          parcela_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nota_vinculos_despesa_id_fkey";
            columns: ["despesa_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nota_vinculos_nota_id_fkey";
            columns: ["nota_id"];
            isOneToOne: false;
            referencedRelation: "notas_fiscais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nota_vinculos_parcela_id_fkey";
            columns: ["parcela_id"];
            isOneToOne: false;
            referencedRelation: "parcelas";
            referencedColumns: ["id"];
          },
        ];
      };
      notas_fiscais: {
        Row: {
          categoria: string;
          chave_acesso: string | null;
          created_at: string;
          created_by: string | null;
          data_compra: string;
          descricao: string | null;
          drive_folder_id: string | null;
          estabelecimento: string | null;
          garantia_dias: number | null;
          garantia_fim: string | null;
          garantia_meses: number | null;
          grupo_id: string | null;
          id: string;
          observacoes: string | null;
          status_captura: string;
          uf: string | null;
          updated_at: string;
          url_consulta: string | null;
          valor_total: number;
        };
        Insert: {
          categoria?: string;
          chave_acesso?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_compra?: string;
          descricao?: string | null;
          drive_folder_id?: string | null;
          estabelecimento?: string | null;
          garantia_dias?: number | null;
          garantia_fim?: string | null;
          garantia_meses?: number | null;
          grupo_id?: string | null;
          id?: string;
          observacoes?: string | null;
          status_captura?: string;
          uf?: string | null;
          updated_at?: string;
          url_consulta?: string | null;
          valor_total?: number;
        };
        Update: {
          categoria?: string;
          chave_acesso?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_compra?: string;
          descricao?: string | null;
          drive_folder_id?: string | null;
          estabelecimento?: string | null;
          garantia_dias?: number | null;
          garantia_fim?: string | null;
          garantia_meses?: number | null;
          grupo_id?: string | null;
          id?: string;
          observacoes?: string | null;
          status_captura?: string;
          uf?: string | null;
          updated_at?: string;
          url_consulta?: string | null;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      parcela_auditoria: {
        Row: {
          alterado_em: string;
          alterado_por: string | null;
          campo: string;
          despesa_id: string | null;
          fatura_id: string | null;
          id: string;
          motivo: string;
          parcela_id: string;
          valor_antigo: string | null;
          valor_novo: string | null;
        };
        Insert: {
          alterado_em?: string;
          alterado_por?: string | null;
          campo: string;
          despesa_id?: string | null;
          fatura_id?: string | null;
          id?: string;
          motivo: string;
          parcela_id: string;
          valor_antigo?: string | null;
          valor_novo?: string | null;
        };
        Update: {
          alterado_em?: string;
          alterado_por?: string | null;
          campo?: string;
          despesa_id?: string | null;
          fatura_id?: string | null;
          id?: string;
          motivo?: string;
          parcela_id?: string;
          valor_antigo?: string | null;
          valor_novo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "parcela_auditoria_despesa_id_fkey";
            columns: ["despesa_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parcela_auditoria_fatura_id_fkey";
            columns: ["fatura_id"];
            isOneToOne: false;
            referencedRelation: "import_faturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parcela_auditoria_parcela_id_fkey";
            columns: ["parcela_id"];
            isOneToOne: false;
            referencedRelation: "parcelas";
            referencedColumns: ["id"];
          },
        ];
      };
      parcelas: {
        Row: {
          confianca_data: string | null;
          created_at: string;
          data_pagamento: string | null;
          dedup_key: string | null;
          despesa_id: string;
          fatura_id: string | null;
          grupo_id: string | null;
          id: string;
          moeda: string;
          numero: number;
          origem: string;
          paga: boolean;
          situacao_temporal: string | null;
          total: number;
          updated_at: string;
          valor: number;
          valor_centavos: number | null;
          valor_estimado: boolean;
          vencimento: string;
        };
        Insert: {
          confianca_data?: string | null;
          created_at?: string;
          data_pagamento?: string | null;
          dedup_key?: string | null;
          despesa_id: string;
          fatura_id?: string | null;
          grupo_id?: string | null;
          id?: string;
          moeda?: string;
          numero: number;
          origem?: string;
          paga?: boolean;
          situacao_temporal?: string | null;
          total: number;
          updated_at?: string;
          valor: number;
          valor_centavos?: number | null;
          valor_estimado?: boolean;
          vencimento: string;
        };
        Update: {
          confianca_data?: string | null;
          created_at?: string;
          data_pagamento?: string | null;
          dedup_key?: string | null;
          despesa_id?: string;
          fatura_id?: string | null;
          grupo_id?: string | null;
          id?: string;
          moeda?: string;
          numero?: number;
          origem?: string;
          paga?: boolean;
          situacao_temporal?: string | null;
          total?: number;
          updated_at?: string;
          valor?: number;
          valor_centavos?: number | null;
          valor_estimado?: boolean;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parcelas_despesa_id_fkey";
            columns: ["despesa_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parcelas_fatura_id_fkey";
            columns: ["fatura_id"];
            isOneToOne: false;
            referencedRelation: "import_faturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parcelas_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      permissoes: {
        Row: {
          grupo_id: string | null;
          id: string;
          modulo: string;
          pode_editar: boolean;
          pode_excluir: boolean;
          pode_ver: boolean;
          user_id: string;
        };
        Insert: {
          grupo_id?: string | null;
          id?: string;
          modulo: string;
          pode_editar?: boolean;
          pode_excluir?: boolean;
          pode_ver?: boolean;
          user_id: string;
        };
        Update: {
          grupo_id?: string | null;
          id?: string;
          modulo?: string;
          pode_editar?: boolean;
          pode_excluir?: boolean;
          pode_ver?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "permissoes_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      preferencias_usuario: {
        Row: {
          fonte: string;
          layout_menu: string;
          paleta: string;
          tema: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          fonte?: string;
          layout_menu?: string;
          paleta?: string;
          tema?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          fonte?: string;
          layout_menu?: string;
          paleta?: string;
          tema?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          ativo: boolean;
          convidado_por: string | null;
          cpf: string;
          created_at: string;
          data_nascimento: string | null;
          email: string | null;
          grupo_id: string | null;
          id: string;
          nome: string;
          senha_temporaria: boolean;
          telefone: string | null;
        };
        Insert: {
          ativo?: boolean;
          convidado_por?: string | null;
          cpf: string;
          created_at?: string;
          data_nascimento?: string | null;
          email?: string | null;
          grupo_id?: string | null;
          id: string;
          nome: string;
          senha_temporaria?: boolean;
          telefone?: string | null;
        };
        Update: {
          ativo?: boolean;
          convidado_por?: string | null;
          cpf?: string;
          created_at?: string;
          data_nascimento?: string | null;
          email?: string | null;
          grupo_id?: string | null;
          id?: string;
          nome?: string;
          senha_temporaria?: boolean;
          telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_convidado_por_fkey";
            columns: ["convidado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      receitas: {
        Row: {
          categoria: string;
          created_at: string;
          created_by: string | null;
          data_recebimento: string;
          descricao: string;
          frequencia: string | null;
          grupo_id: string | null;
          id: string;
          moeda: string;
          observacoes: string | null;
          reajuste_indice: string | null;
          reajuste_inicio: string | null;
          reajuste_modo: string | null;
          reajuste_percentual: number | null;
          reajuste_periodicidade: string | null;
          reajuste_valor_fixo: number | null;
          recorrencia_inicio: string | null;
          recorrencia_meses: number | null;
          recorrencia_sem_prazo: boolean;
          recorrente: boolean;
          responsavel: string | null;
          updated_at: string;
          valor: number;
        };
        Insert: {
          categoria?: string;
          created_at?: string;
          created_by?: string | null;
          data_recebimento: string;
          descricao: string;
          frequencia?: string | null;
          grupo_id?: string | null;
          id?: string;
          moeda?: string;
          observacoes?: string | null;
          reajuste_indice?: string | null;
          reajuste_inicio?: string | null;
          reajuste_modo?: string | null;
          reajuste_percentual?: number | null;
          reajuste_periodicidade?: string | null;
          reajuste_valor_fixo?: number | null;
          recorrencia_inicio?: string | null;
          recorrencia_meses?: number | null;
          recorrencia_sem_prazo?: boolean;
          recorrente?: boolean;
          responsavel?: string | null;
          updated_at?: string;
          valor: number;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          created_by?: string | null;
          data_recebimento?: string;
          descricao?: string;
          frequencia?: string | null;
          grupo_id?: string | null;
          id?: string;
          moeda?: string;
          observacoes?: string | null;
          reajuste_indice?: string | null;
          reajuste_inicio?: string | null;
          reajuste_modo?: string | null;
          reajuste_percentual?: number | null;
          reajuste_periodicidade?: string | null;
          reajuste_valor_fixo?: number | null;
          recorrencia_inicio?: string | null;
          recorrencia_meses?: number | null;
          recorrencia_sem_prazo?: boolean;
          recorrente?: boolean;
          responsavel?: string | null;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "receitas_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      veiculo_documentos: {
        Row: {
          created_at: string;
          criado_por: string | null;
          grupo_id: string | null;
          id: string;
          nome: string;
          storage_path: string;
          tipo: string;
          veiculo_id: string;
        };
        Insert: {
          created_at?: string;
          criado_por?: string | null;
          grupo_id?: string | null;
          id?: string;
          nome: string;
          storage_path: string;
          tipo?: string;
          veiculo_id: string;
        };
        Update: {
          created_at?: string;
          criado_por?: string | null;
          grupo_id?: string | null;
          id?: string;
          nome?: string;
          storage_path?: string;
          tipo?: string;
          veiculo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "veiculo_documentos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "veiculo_documentos_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "veiculos";
            referencedColumns: ["id"];
          },
        ];
      };
      veiculo_eventos: {
        Row: {
          created_at: string;
          criado_por: string | null;
          custo: number | null;
          data: string;
          descricao: string | null;
          grupo_id: string | null;
          id: string;
          km: number | null;
          tipo: string;
          veiculo_id: string;
        };
        Insert: {
          created_at?: string;
          criado_por?: string | null;
          custo?: number | null;
          data: string;
          descricao?: string | null;
          grupo_id?: string | null;
          id?: string;
          km?: number | null;
          tipo: string;
          veiculo_id: string;
        };
        Update: {
          created_at?: string;
          criado_por?: string | null;
          custo?: number | null;
          data?: string;
          descricao?: string | null;
          grupo_id?: string | null;
          id?: string;
          km?: number | null;
          tipo?: string;
          veiculo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "veiculo_eventos_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "veiculos";
            referencedColumns: ["id"];
          },
        ];
      };
      veiculos: {
        Row: {
          ano: number | null;
          ativo: boolean;
          chassi: string | null;
          created_at: string;
          created_by: string | null;
          data_compra: string | null;
          data_proxima_troca_oleo: string | null;
          data_vencimento_ipva: string | null;
          data_vencimento_seguro: string | null;
          grupo_id: string | null;
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
        Insert: {
          ano?: number | null;
          ativo?: boolean;
          chassi?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_compra?: string | null;
          data_proxima_troca_oleo?: string | null;
          data_vencimento_ipva?: string | null;
          data_vencimento_seguro?: string | null;
          grupo_id?: string | null;
          id?: string;
          km_atual?: number | null;
          km_proxima_troca_oleo?: number | null;
          marca?: string | null;
          modelo?: string | null;
          motorista_principal?: string | null;
          nome: string;
          observacoes?: string | null;
          placa?: string | null;
          renavam?: string | null;
          updated_at?: string;
        };
        Update: {
          ano?: number | null;
          ativo?: boolean;
          chassi?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_compra?: string | null;
          data_proxima_troca_oleo?: string | null;
          data_vencimento_ipva?: string | null;
          data_vencimento_seguro?: string | null;
          grupo_id?: string | null;
          id?: string;
          km_atual?: number | null;
          km_proxima_troca_oleo?: number | null;
          marca?: string | null;
          modelo?: string | null;
          motorista_principal?: string | null;
          nome?: string;
          observacoes?: string | null;
          placa?: string | null;
          renavam?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "veiculos_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "admin" | "comum";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "comum"],
    },
  },
} as const;
