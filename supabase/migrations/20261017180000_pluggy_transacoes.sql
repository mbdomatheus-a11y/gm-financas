-- Lançamentos vindos da Pluggy (Open Finance). Guarda o retorno bruto para conferência.
-- Nesta fase NÃO grava nada em despesas ou receitas; isso vem depois, com revisão antes do OK.
-- Acesso só pelo servidor (service role). Sem acesso para anon/authenticated.
create table if not exists public.pluggy_transacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null,
  transaction_id text not null unique,
  account_id text,
  data date,
  descricao text,
  valor numeric(14,2),
  tipo text,
  status text,
  categoria_pluggy text,
  atualizado_em timestamptz not null default now()
);
create index if not exists pluggy_transacoes_item_idx on public.pluggy_transacoes (item_id, data);
alter table public.pluggy_transacoes enable row level security;
revoke all on public.pluggy_transacoes from anon, authenticated;
