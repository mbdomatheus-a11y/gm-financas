ALTER TABLE public.import_faturas
  ADD COLUMN IF NOT EXISTS limite_total numeric,
  ADD COLUMN IF NOT EXISTS limite_utilizado numeric,
  ADD COLUMN IF NOT EXISTS limite_disponivel numeric;