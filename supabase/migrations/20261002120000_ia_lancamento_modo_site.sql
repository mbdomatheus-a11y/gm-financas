-- Frente 2 do plano de 2026-10-02 (claude/plano-fase2-lancamento-2026-10-02.md
-- no projeto Claude): admin do site define o padrão de quais entradas
-- (texto/áudio) o lançamento rápido por IA aceita. Cada grupo pode sobrepor
-- esse padrão pra si mesmo via `configuracoes_casal` (chave
-- "<grupo_id>:ia_lancamento_modo"), sem precisar de coluna nova — mesmo
-- padrão já usado por `conciliacao_faturas_modo`.
ALTER TABLE public.configuracoes_acesso_site
  ADD COLUMN IF NOT EXISTS ia_lancamento_modo_padrao text NOT NULL DEFAULT 'ambos'
    CHECK (ia_lancamento_modo_padrao IN ('ambos', 'somente_texto', 'somente_audio', 'desabilitado'));

NOTIFY pgrst, 'reload schema';
