-- Terceiro modo da fatura mensal, vínculo do histórico de limites ao cartão
-- e versões publicadas exibidas como notificações.
ALTER TABLE public.fatura_mes
  ADD COLUMN IF NOT EXISTS modo_calculo text,
  ADD COLUMN IF NOT EXISTS concluida_por_importacao_em timestamptz;

UPDATE public.fatura_mes
SET modo_calculo = CASE WHEN inclui_parcelas THEN 'inclui_parcelas' ELSE 'somar_parcelas' END
WHERE modo_calculo IS NULL;

ALTER TABLE public.fatura_mes
  ALTER COLUMN modo_calculo SET DEFAULT 'inclui_parcelas',
  ALTER COLUMN modo_calculo SET NOT NULL;

ALTER TABLE public.fatura_mes DROP CONSTRAINT IF EXISTS fatura_mes_modo_calculo_check;
ALTER TABLE public.fatura_mes ADD CONSTRAINT fatura_mes_modo_calculo_check
  CHECK (modo_calculo IN ('inclui_parcelas', 'somar_parcelas', 'somente_total'));

ALTER TABLE public.import_faturas
  ADD COLUMN IF NOT EXISTS cartao_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS import_faturas_cartao_competencia_idx
  ON public.import_faturas(cartao_id, competencia);

CREATE TABLE IF NOT EXISTS public.versoes_site (
  versao text PRIMARY KEY,
  build_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  limpo_em timestamptz,
  limpo_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.versoes_site ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.versoes_site FROM anon, authenticated;
GRANT ALL ON public.versoes_site TO service_role;
