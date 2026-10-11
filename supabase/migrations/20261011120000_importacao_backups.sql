-- Backup de substituição de fatura fechada (2026-10-11).
-- Ao confirmar uma fatura marcada como "fechada", as parcelas e compras da
-- fatura anterior do mesmo cartão e mês são guardadas aqui antes de sair do
-- banco. "Desfazer" restaura esse snapshot. Só o backup ativo mais recente de
-- cada cartão e mês vale; uma nova substituição marca o anterior como substituído.
CREATE TABLE IF NOT EXISTS public.importacao_backups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  grupo_id uuid,
  cartao_id uuid,
  competencia text not null,
  lote_id uuid references public.import_lotes(id) on delete set null,
  criado_em timestamptz not null default now(),
  status text not null default 'ativo' check (status in ('ativo', 'substituido', 'desfeito')),
  faturas_antigas uuid[] not null default '{}',
  faturas_novas uuid[] not null default '{}',
  dados jsonb not null default '{}'::jsonb,
  desfeito_em timestamptz
);

CREATE INDEX IF NOT EXISTS importacao_backups_cartao_mes_idx
  ON public.importacao_backups (cartao_id, competencia, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacao_backups TO authenticated;
GRANT ALL ON public.importacao_backups TO service_role;

ALTER TABLE public.importacao_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY importacao_backups_grupo ON public.importacao_backups
  FOR ALL TO authenticated
  USING (grupo_id = private.meu_grupo_id())
  WITH CHECK (grupo_id = private.meu_grupo_id());

NOTIFY pgrst, 'reload schema';
