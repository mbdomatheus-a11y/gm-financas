CREATE TABLE public.fatura_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_id uuid REFERENCES public.cartoes(id) ON DELETE CASCADE,
  banco_id uuid REFERENCES public.bancos(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  total_informado numeric NOT NULL DEFAULT 0,
  inclui_parcelas boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'aberta',
  fechada_em timestamptz,
  total_real numeric,
  despesa_avulsa_id uuid REFERENCES public.despesas(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fatura_mes_cartao_comp_idx ON public.fatura_mes (cartao_id, competencia) WHERE cartao_id IS NOT NULL;
CREATE UNIQUE INDEX fatura_mes_banco_comp_idx ON public.fatura_mes (banco_id, competencia) WHERE cartao_id IS NULL AND banco_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fatura_mes TO authenticated;
GRANT ALL ON public.fatura_mes TO service_role;
ALTER TABLE public.fatura_mes ENABLE ROW LEVEL SECURITY;
CREATE POLICY fatura_mes_all ON public.fatura_mes FOR ALL TO authenticated USING (private.is_active_member()) WITH CHECK (private.is_active_member());
CREATE TRIGGER update_fatura_mes_updated_at BEFORE UPDATE ON public.fatura_mes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.configuracoes_casal (
  chave text PRIMARY KEY,
  valor text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_casal TO authenticated;
GRANT ALL ON public.configuracoes_casal TO service_role;
ALTER TABLE public.configuracoes_casal ENABLE ROW LEVEL SECURITY;
CREATE POLICY configuracoes_casal_all ON public.configuracoes_casal FOR ALL TO authenticated USING (private.is_active_member()) WITH CHECK (private.is_active_member());
CREATE TRIGGER update_configuracoes_casal_updated_at BEFORE UPDATE ON public.configuracoes_casal FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.import_faturas ADD COLUMN IF NOT EXISTS fechada_em timestamptz;