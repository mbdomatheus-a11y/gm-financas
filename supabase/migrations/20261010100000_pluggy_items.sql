-- Integração Pluggy (Open Finance), somente conta admin principal. Guarda só o id da conexão (item).
create table if not exists public.pluggy_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null unique,
  conector text,
  status text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.pluggy_items enable row level security;
revoke all on public.pluggy_items from anon, authenticated;
