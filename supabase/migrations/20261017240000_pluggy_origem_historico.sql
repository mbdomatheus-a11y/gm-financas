-- A origem "pluggy" precisa ser aceita pela tabela de despesas (a importação falhava sem isso).
alter table public.despesas drop constraint if exists despesas_origem_check;
alter table public.despesas add constraint despesas_origem_check check (
  origem = any (array['manual', 'importacao', 'fatura_rapida', 'fatura_total_manual', 'fatura_total_concluida', 'importacao_substituicao', 'pluggy'])
);

-- Histórico de cada sincronização (automática, diária ou manual).
create table if not exists public.pluggy_sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null,
  iniciado_em timestamptz not null default now(),
  terminado_em timestamptz,
  status text not null default 'em_andamento',
  primeira boolean not null default false,
  transacoes_lidas integer not null default 0,
  despesas_criadas integer not null default 0,
  mensagem text
);
alter table public.pluggy_sincronizacoes enable row level security;
revoke all on public.pluggy_sincronizacoes from anon, authenticated;
