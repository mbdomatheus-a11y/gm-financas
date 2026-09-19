BEGIN;

-- A RLS já restringe categoria_regras por grupo. A unicidade antiga, porém,
-- ainda impedia dois grupos de cadastrar o mesmo estabelecimento.
ALTER TABLE public.categoria_regras
  DROP CONSTRAINT IF EXISTS categoria_regras_estabelecimento_normalizado_tipo_regra_key;

DROP INDEX IF EXISTS public.categoria_regras_estab_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS categoria_regras_grupo_estab_tipo_uidx
  ON public.categoria_regras (grupo_id, estabelecimento_normalizado, tipo_regra);

COMMIT;
