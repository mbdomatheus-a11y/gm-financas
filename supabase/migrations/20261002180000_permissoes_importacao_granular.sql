-- Etapa D (plano-importacao-v2.md): permissões granulares de importação por
-- usuário. Reaproveita a tabela `permissoes` já existente (uma linha por
-- `(user_id, modulo)`) em vez de criar tabela nova — basta uma linha com
-- `modulo = 'importar'`. As colunas genéricas pode_ver/pode_editar/
-- pode_excluir continuam existindo (pode_ver passa a controlar acesso à
-- tela /importar); as 3 colunas novas abaixo são específicas do módulo de
-- importação e ignoradas para os demais módulos.
ALTER TABLE public.permissoes
  ADD COLUMN IF NOT EXISTS pode_importar_lancamentos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_importar_parcelamentos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_importar_limite boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
