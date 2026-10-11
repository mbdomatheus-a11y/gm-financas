-- Edição de itens da lista de compras (2026-10-11).
-- Quem edita um item registra quando e por quem. Se o item já tinha aprovações,
-- as aprovações são zeradas e o item fica marcado como "precisa de nova
-- autorização" até atingir de novo o número de aprovações necessárias.
ALTER TABLE public.lista_compras
  ADD COLUMN IF NOT EXISTS editado_em timestamptz,
  ADD COLUMN IF NOT EXISTS editado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS precisa_reaprovacao boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
