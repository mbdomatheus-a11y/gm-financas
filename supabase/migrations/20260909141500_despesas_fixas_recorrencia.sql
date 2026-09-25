-- Migration: Novas colunas para recorrência e reajuste de despesas fixas

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS duracao_tipo text DEFAULT 'sem_prazo' CHECK (duracao_tipo IN ('sem_prazo', 'determinado')),
  ADD COLUMN IF NOT EXISTS duracao_meses integer,
  ADD COLUMN IF NOT EXISTS reajuste_tipo text DEFAULT 'sem_reajuste' CHECK (reajuste_tipo IN ('sem_reajuste', 'composto')),
  ADD COLUMN IF NOT EXISTS reajuste_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS reajuste_periodicidade text CHECK (reajuste_periodicidade IN ('mensal', 'semestral', 'anual') OR reajuste_periodicidade IS NULL),
  ADD COLUMN IF NOT EXISTS reajuste_indice text,
  ADD COLUMN IF NOT EXISTS reajuste_primeiro_mes text;

-- Comentários descritivos
COMMENT ON COLUMN public.despesas.duracao_tipo IS 'Duração da despesa fixa: sem_prazo (indeterminada) ou determinado';
COMMENT ON COLUMN public.despesas.duracao_meses IS 'Número de meses da duração caso determinado';
COMMENT ON COLUMN public.despesas.reajuste_tipo IS 'Tipo de reajuste: sem_reajuste ou composto';
COMMENT ON COLUMN public.despesas.reajuste_percentual IS 'Percentual do reajuste periódico (ex: 1.0 para 1%)';
COMMENT ON COLUMN public.despesas.reajuste_periodicidade IS 'Periodicidade do reajuste: mensal, semestral ou anual';
COMMENT ON COLUMN public.despesas.reajuste_indice IS 'Identificação do índice (ex: IPCA, IGP-M)';
COMMENT ON COLUMN public.despesas.reajuste_primeiro_mes IS 'Competência do primeiro reajuste no formato YYYY-MM';

-- Migração não destrutiva de dados existentes de despesas fixas antigas:
-- Para despesas que foram salvas com total_parcelas > 1 (gerador antigo de 24x),
-- o valor_total armazenava a soma acumulada de todas as parcelas.
-- Ajustamos o valor_total para o valor unitário da mensalidade e marcamos como sem_prazo.
UPDATE public.despesas
SET 
  valor_total = round(valor_total / total_parcelas, 2),
  duracao_tipo = 'sem_prazo',
  duracao_meses = NULL,
  reajuste_tipo = 'sem_reajuste'
WHERE tipo = 'fixa' AND total_parcelas > 1 AND duracao_tipo IS NULL;
