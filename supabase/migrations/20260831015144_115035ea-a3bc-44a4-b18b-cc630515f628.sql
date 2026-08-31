CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_acesso text UNIQUE,
  url_consulta text,
  uf text,
  estabelecimento text,
  descricao text,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  valor_total numeric NOT NULL DEFAULT 0,
  categoria text NOT NULL DEFAULT 'outros',
  garantia_meses integer,
  garantia_dias integer,
  garantia_fim date,
  status_captura text NOT NULL DEFAULT 'manual',
  drive_folder_id text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY notas_fiscais_all ON public.notas_fiscais FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
CREATE TRIGGER update_notas_fiscais_updated_at BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nota_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  garantia_meses integer,
  garantia_fim date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_itens TO authenticated;
GRANT ALL ON public.nota_itens TO service_role;
ALTER TABLE public.nota_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY nota_itens_all ON public.nota_itens FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());

CREATE TABLE public.nota_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  link text,
  thumbnail_link text,
  mime_type text,
  nome text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_arquivos TO authenticated;
GRANT ALL ON public.nota_arquivos TO service_role;
ALTER TABLE public.nota_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY nota_arquivos_all ON public.nota_arquivos FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());

CREATE INDEX notas_fiscais_data_idx ON public.notas_fiscais (data_compra DESC);
CREATE INDEX nota_itens_nota_idx ON public.nota_itens (nota_id);
CREATE INDEX nota_arquivos_nota_idx ON public.nota_arquivos (nota_id);