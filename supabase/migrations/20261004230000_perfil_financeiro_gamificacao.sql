-- Gamificação financeira alimentada por perguntas ao usuário (2026-10-04).
-- Também consolida colunas da migration 20261003180000 que não haviam sido aplicadas em produção.
ALTER TABLE public.profiles ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS horas_trabalho_mes integer DEFAULT 160,
  ADD COLUMN IF NOT EXISTS renda_liquida_informada numeric(12,2),
  ADD COLUMN IF NOT EXISTS compromissos_fixos_informados numeric(12,2),
  ADD COLUMN IF NOT EXISTS perfil_financeiro_respondido_em timestamptz;
ALTER TABLE public.lista_compras
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(12,2),
  ADD COLUMN IF NOT EXISTS horizonte text NOT NULL DEFAULT 'imediato';
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique
  ON public.profiles(cpf) WHERE cpf IS NOT NULL AND cpf <> '';
NOTIFY pgrst, 'reload schema';
