create table if not exists public.dados_exemplo_semeados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  grupo_id uuid,
  semeado_em timestamptz not null default now(),
  visto_em timestamptz
);
alter table public.dados_exemplo_semeados enable row level security;
-- sem policies: acesso apenas via service role (server functions)
