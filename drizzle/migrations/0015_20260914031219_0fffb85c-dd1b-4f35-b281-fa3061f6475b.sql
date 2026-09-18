-- Fluxo de aprovação da lista de compras: um item pode exigir N aprovações
-- de outras pessoas com acesso ao dashboard (nunca de quem criou o item)
-- antes de poder ser marcado como comprado. A tabela já usa uma única
-- política "tudo ou nada" (private.is_active_member()), então não há RLS
-- nova aqui — só as colunas; a regra de quem pode aprovar e o bloqueio de
-- "comprar sem aprovação suficiente" ficam no app (mesmo modelo de
-- confiança já usado no restante do lista_compras).
ALTER TABLE public.lista_compras
  ADD COLUMN IF NOT EXISTS aprovacoes_necessarias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.lista_compras.aprovacoes_necessarias IS
  'Quantas aprovações de outras pessoas (exceto quem criou o item) são necessárias antes de marcar como comprado. 0 = compra livre, sem aprovação.';
COMMENT ON COLUMN public.lista_compras.aprovado_por IS
  'IDs dos usuários que já aprovaram a compra deste item.';
