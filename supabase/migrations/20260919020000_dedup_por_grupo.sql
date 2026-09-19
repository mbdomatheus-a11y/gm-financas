-- A mesma fatura pode pertencer a grupos distintos. Dentro de cada grupo,
-- continuamos impedindo a duplicação de arquivos, despesas e parcelas.
BEGIN;

ALTER TABLE public.import_faturas
  DROP CONSTRAINT IF EXISTS import_faturas_arquivo_hash_key;
DROP INDEX IF EXISTS public.import_faturas_hash_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS import_faturas_grupo_hash_uidx
  ON public.import_faturas (grupo_id, arquivo_hash);

DROP INDEX IF EXISTS public.despesas_dedup_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS despesas_dedup_key_uidx
  ON public.despesas (grupo_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

DROP INDEX IF EXISTS public.parcelas_dedup_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS parcelas_dedup_key_uidx
  ON public.parcelas (grupo_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

COMMIT;
