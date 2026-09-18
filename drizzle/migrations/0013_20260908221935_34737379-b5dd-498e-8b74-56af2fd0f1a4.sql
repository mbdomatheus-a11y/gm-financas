CREATE TABLE IF NOT EXISTS public.fatura_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura text NOT NULL,
  banco text,
  emissor text,
  colunas jsonb NOT NULL DEFAULT '{}'::jsonb,
  formato_data text,
  formato_valor text,
  ancora_inicio text,
  ancora_fim text,
  acertos integer NOT NULL DEFAULT 1,
  ultimo_uso timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fatura_layouts_assinatura_uidx
  ON public.fatura_layouts (assinatura);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fatura_layouts TO authenticated;
GRANT ALL ON public.fatura_layouts TO service_role;

ALTER TABLE public.fatura_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY fatura_layouts_all ON public.fatura_layouts
  FOR ALL TO authenticated
  USING (private.is_active_member())
  WITH CHECK (private.is_active_member());

CREATE TRIGGER update_fatura_layouts_updated_at
  BEFORE UPDATE ON public.fatura_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();