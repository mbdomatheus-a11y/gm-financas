ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS estabelecimento text,
  ADD COLUMN IF NOT EXISTS estabelecimento_normalizado text,
  ADD COLUMN IF NOT EXISTS subcategoria text,
  ADD COLUMN IF NOT EXISTS categoria_sugerida text,
  ADD COLUMN IF NOT EXISTS subcategoria_sugerida text,
  ADD COLUMN IF NOT EXISTS confianca_categoria text,
  ADD COLUMN IF NOT EXISTS categoria_confirmada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regra_id uuid;

CREATE TABLE IF NOT EXISTS public.categoria_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto_original text,
  estabelecimento_normalizado text NOT NULL,
  tipo_regra text NOT NULL DEFAULT 'estabelecimento',
  categoria text NOT NULL,
  subcategoria text,
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS categoria_regras_estab_uidx
  ON public.categoria_regras (estabelecimento_normalizado, tipo_regra);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categoria_regras TO authenticated;
GRANT ALL ON public.categoria_regras TO service_role;

ALTER TABLE public.categoria_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY categoria_regras_all ON public.categoria_regras
  FOR ALL TO authenticated
  USING (private.is_active_member())
  WITH CHECK (private.is_active_member());

CREATE TRIGGER update_categoria_regras_updated_at
  BEFORE UPDATE ON public.categoria_regras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();