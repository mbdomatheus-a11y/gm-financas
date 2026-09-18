ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS recorrencia_inicio date,
  ADD COLUMN IF NOT EXISTS recorrencia_sem_prazo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_meses integer,
  ADD COLUMN IF NOT EXISTS reajuste_percentual numeric,
  ADD COLUMN IF NOT EXISTS reajuste_periodicidade text,
  ADD COLUMN IF NOT EXISTS reajuste_indice text,
  ADD COLUMN IF NOT EXISTS reajuste_inicio date;

ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_reajuste_periodicidade_check
  CHECK (reajuste_periodicidade IS NULL OR reajuste_periodicidade IN ('mensal','semestral','anual'));

ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_recorrencia_meses_check
  CHECK (recorrencia_meses IS NULL OR recorrencia_meses > 0);