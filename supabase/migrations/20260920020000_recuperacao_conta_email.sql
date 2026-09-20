create table if not exists public.contas_recuperacao_codigos (
  id uuid primary key default gen_random_uuid(),
  conta_excluida_id uuid not null references public.contas_excluidas(id) on delete cascade,
  token_hash text not null unique,
  tentativas integer not null default 0 check (tentativas between 0 and 5),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '15 minutes'
);

create index if not exists contas_recuperacao_codigos_conta_idx
  on public.contas_recuperacao_codigos(conta_excluida_id, criado_em desc);

alter table public.contas_recuperacao_codigos enable row level security;
revoke all on public.contas_recuperacao_codigos from public, anon, authenticated;
grant all on public.contas_recuperacao_codigos to service_role;

notify pgrst, 'reload schema';
