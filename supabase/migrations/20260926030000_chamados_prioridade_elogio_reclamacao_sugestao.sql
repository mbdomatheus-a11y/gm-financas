-- Troca as opções de "prioridade" do formulário de suporte para categorias
-- de tipo de mensagem (Elogio/Reclamação/Sugestão), a pedido do proprietário.
-- Mensagens já existentes com os valores antigos são remapeadas para não
-- violar a nova constraint (best-effort: baixa/normal -> sugestao,
-- alta/urgente -> reclamacao).
ALTER TABLE public.chamados_suporte DROP CONSTRAINT IF EXISTS chamados_suporte_prioridade_check;

UPDATE public.chamados_suporte
SET prioridade = CASE
  WHEN prioridade IN ('baixa', 'normal') THEN 'sugestao'
  WHEN prioridade IN ('alta', 'urgente') THEN 'reclamacao'
  ELSE prioridade
END
WHERE prioridade NOT IN ('elogio', 'reclamacao', 'sugestao');

ALTER TABLE public.chamados_suporte ALTER COLUMN prioridade SET DEFAULT 'sugestao';
ALTER TABLE public.chamados_suporte ADD CONSTRAINT chamados_suporte_prioridade_check
  CHECK (prioridade IN ('elogio', 'reclamacao', 'sugestao'));

NOTIFY pgrst, 'reload schema';
