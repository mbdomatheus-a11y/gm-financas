-- Migration Manual: Adicionar colunas de categoria e depreciacao em nota_itens
-- Executar no SQL Editor do Supabase (projeto wjapagkdgjlavonbmjdu)
-- Data: 2026-10-17

ALTER TABLE public.nota_itens
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS subcategoria text,
  ADD COLUMN IF NOT EXISTS deprecia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS meses_depreciacao integer;

COMMENT ON COLUMN public.nota_itens.categoria IS 'Macro categoria do item (ex: Alimentação, Tecnologia, Mercado)';
COMMENT ON COLUMN public.nota_itens.subcategoria IS 'Subcategoria do item (ex: Restaurante, Fast-food)';
COMMENT ON COLUMN public.nota_itens.deprecia IS 'Se o item é um bem sujeito a depreciação patrimonial';
COMMENT ON COLUMN public.nota_itens.meses_depreciacao IS 'Vida útil estimada em meses para cálculo de depreciação linear';
