-- Evolução comercial e de saúde pessoal. Não remove dados existentes.
BEGIN;

ALTER TABLE public.pet_animais
  ADD COLUMN IF NOT EXISTS sexo text CHECK (sexo IN ('macho','femea','nao_informado')),
  ADD COLUMN IF NOT EXISTS pelagem text,
  ADD COLUMN IF NOT EXISTS restricoes text,
  ADD COLUMN IF NOT EXISTS tutor_nome text;

ALTER TABLE public.pet_vacinas
  ADD COLUMN IF NOT EXISTS fabricante text,
  ADD COLUMN IF NOT EXISTS lote text,
  ADD COLUMN IF NOT EXISTS fabricada_em date,
  ADD COLUMN IF NOT EXISTS validade_em date,
  ADD COLUMN IF NOT EXISTS veterinario text,
  ADD COLUMN IF NOT EXISTS crmv text,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual','imagem','pdf')),
  ADD COLUMN IF NOT EXISTS revisada_em timestamptz;

ALTER TABLE public.exames_registros
  ADD COLUMN IF NOT EXISTS laboratorio text,
  ADD COLUMN IF NOT EXISTS status_importacao text NOT NULL DEFAULT 'aprovado'
    CHECK (status_importacao IN ('rascunho','aprovado','descartado')),
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual','imagem','pdf')),
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz;

ALTER TABLE public.exame_medicoes
  ADD COLUMN IF NOT EXISTS valor_texto text,
  ADD COLUMN IF NOT EXISTS referencia text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

CREATE TABLE IF NOT EXISTS public.historico_alertas_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  referencia_tipo text,
  referencia_id uuid,
  exibido_em timestamptz NOT NULL DEFAULT now(),
  lido_em timestamptz
);
ALTER TABLE public.historico_alertas_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY historico_alertas_proprio ON public.historico_alertas_usuario
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, UPDATE ON public.historico_alertas_usuario TO authenticated;
GRANT ALL ON public.historico_alertas_usuario TO service_role;

CREATE INDEX IF NOT EXISTS historico_alertas_usuario_data_idx
  ON public.historico_alertas_usuario (user_id, exibido_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS historico_alertas_usuario_comunicado_uidx
  ON public.historico_alertas_usuario (user_id, referencia_id)
  WHERE referencia_tipo = 'comunicado';
CREATE INDEX IF NOT EXISTS exame_medicoes_exame_idx ON public.exame_medicoes (exame_id, data_medicao DESC);
CREATE INDEX IF NOT EXISTS pet_vacinas_proxima_dose_idx ON public.pet_vacinas (grupo_id, proxima_dose_em);

NOTIFY pgrst, 'reload schema';
COMMIT;
