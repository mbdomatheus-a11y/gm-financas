-- Migration: Torna CPF opcional no cadastro, adiciona jornada de trabalho no perfil e enriquece a lista de compras
-- Data: 2026-10-03

-- 1. Torna o CPF opcional em public.profiles
ALTER TABLE public.profiles ALTER COLUMN cpf DROP NOT NULL;

-- Remove constraint única tradicional de CPF se existir
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cpf_key;

-- Cria índice único parcial: apenas CPFs preenchidos e não vazios devem ser únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique 
ON public.profiles(cpf) 
WHERE cpf IS NOT NULL AND cpf <> '';

-- 2. Adiciona horas de trabalho mensal para cálculo de hora líquida trabalhada (gamificação)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS horas_trabalho_mes integer DEFAULT 160;

COMMENT ON COLUMN public.profiles.horas_trabalho_mes IS 'Carga horária mensal de trabalho em horas (padrão 160h)';

-- 3. Enriquece a lista de compras com valor estimado e horizonte de planejamento
ALTER TABLE public.lista_compras 
ADD COLUMN IF NOT EXISTS valor_estimado numeric(12,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS horizonte text NOT NULL DEFAULT 'imediato';

CREATE INDEX IF NOT EXISTS lista_compras_horizonte_idx ON public.lista_compras (horizonte);

COMMENT ON COLUMN public.lista_compras.valor_estimado IS 'Valor estimado em R$ para cálculo de tempo de trabalho e impacto na renda livre';
COMMENT ON COLUMN public.lista_compras.horizonte IS 'Horizonte do item: imediato (mês atual/consumo) ou longo_prazo (desejos/projetos)';
