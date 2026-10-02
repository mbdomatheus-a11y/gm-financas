ALTER TABLE public.categoria_regras
  ADD COLUMN IF NOT EXISTS padroes text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.categoria_regras
SET padroes = ARRAY[estabelecimento_normalizado]
WHERE (padroes = '{}'::text[] OR padroes IS NULL)
  AND estabelecimento_normalizado IS NOT NULL
  AND estabelecimento_normalizado <> '';

NOTIFY pgrst, 'reload schema';
