-- Tokens de recuperação de senha self-service ("esqueci minha senha").
-- Só é gravado/lido pelo backend com a service role (nunca direto pelo
-- cliente), então RLS fica habilitado sem nenhuma policy — bloqueia
-- qualquer acesso via anon/authenticated key, a service role sempre
-- ignora RLS.
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado boolean not null default false
);

create index if not exists password_reset_tokens_user_id_idx on public.password_reset_tokens(user_id);

alter table public.password_reset_tokens enable row level security;
