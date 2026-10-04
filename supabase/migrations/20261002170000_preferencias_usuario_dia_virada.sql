-- Registra no repositório uma coluna que já existia no banco real (aplicada
-- direto via MCP na sessão de 2026-09-27, item 5 do backlog, "mês do
-- sistema customizável"), mas cujo arquivo de migration nunca foi salvo —
-- descoberto ao corrigir um erro de tsc em types.ts (drift entre o schema
-- real e o types.ts gerado) em 2026-10-02. IF NOT EXISTS torna isso um
-- no-op seguro no banco real, que já tem a coluna.
ALTER TABLE public.preferencias_usuario
  ADD COLUMN IF NOT EXISTS dia_virada smallint;

NOTIFY pgrst, 'reload schema';
