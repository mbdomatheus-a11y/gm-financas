-- Permite identificar o cartão de recebimento e agrupar receitas sem misturar contas.
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS cartao_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS receitas_grupo_cartao_idx
  ON public.receitas (grupo_id, cartao_id);

NOTIFY pgrst, 'reload schema';
