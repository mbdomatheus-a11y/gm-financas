CREATE TABLE public.lista_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'alimentacao',
  quantidade integer NOT NULL DEFAULT 1,
  observacao text,
  comprado boolean NOT NULL DEFAULT false,
  comprado_em timestamp with time zone,
  comprado_por uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lista_compras TO authenticated;
GRANT ALL ON public.lista_compras TO service_role;

ALTER TABLE public.lista_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY lista_compras_all ON public.lista_compras
  FOR ALL TO authenticated
  USING (private.is_active_member())
  WITH CHECK (private.is_active_member());

CREATE TRIGGER update_lista_compras_updated_at
  BEFORE UPDATE ON public.lista_compras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();