-- Migration para atualizar a restrição de CHECK despesas_origem_check e parcelas_origem_check
-- Permitindo os novos modos de origem: fatura_total_manual, fatura_total_concluida, fatura_rapida, importacao_substituicao.

ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_origem_check;

ALTER TABLE public.despesas ADD CONSTRAINT despesas_origem_check
  CHECK (origem IN ('manual', 'importacao', 'fatura_rapida', 'fatura_total_manual', 'fatura_total_concluida', 'importacao_substituicao'));

ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_origem_check;

ALTER TABLE public.parcelas ADD CONSTRAINT parcelas_origem_check
  CHECK (origem IN ('manual', 'importacao', 'fatura_rapida', 'fatura_total_manual', 'fatura_total_concluida', 'importacao_substituicao'));
