ALTER TABLE public.fatura_mes
  ADD COLUMN IF NOT EXISTS tipo_lancamento text NOT NULL DEFAULT 'fixo'
    CHECK (tipo_lancamento IN ('temporario', 'fixo')),
  ADD COLUMN IF NOT EXISTS data_limite date NULL;

NOTIFY pgrst, 'reload schema';
