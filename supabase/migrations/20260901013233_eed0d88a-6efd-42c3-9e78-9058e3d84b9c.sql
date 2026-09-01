CREATE TABLE public.nota_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  despesa_id uuid NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  parcela_id uuid REFERENCES public.parcelas(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX nota_vinculos_uidx ON public.nota_vinculos (nota_id, despesa_id, COALESCE(parcela_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX nota_vinculos_despesa_idx ON public.nota_vinculos (despesa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_vinculos TO authenticated;
GRANT ALL ON public.nota_vinculos TO service_role;

ALTER TABLE public.nota_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY nota_vinculos_all ON public.nota_vinculos
  FOR ALL TO authenticated
  USING (private.is_active_member())
  WITH CHECK (private.is_active_member());

ALTER TABLE public.categoria_regras ADD COLUMN IF NOT EXISTS origem_arquivo text;