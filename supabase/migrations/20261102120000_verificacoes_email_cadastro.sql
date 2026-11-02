-- Confirmação de e-mail por código no cadastro (02/11/2026). A tabela existia no código, mas não no banco:
-- o cadastro falhava com "Não foi possível gerar o código".
create table if not exists public.verificacoes_email (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  finalidade text not null check (finalidade in ('cadastro', 'troca_email')),
  user_id uuid null,
  codigo_hash text not null,
  tentativas integer not null default 0,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '15 minutes'),
  usado_em timestamptz null
);
create index if not exists verificacoes_email_busca_idx on public.verificacoes_email (email, finalidade, criado_em desc);
alter table public.verificacoes_email enable row level security;
-- Sem policies: só o servidor (service role) lê e grava.
