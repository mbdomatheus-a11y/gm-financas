-- Retenção segura de contas excluídas por até 90 dias.
-- A tabela não expõe nenhuma policy: somente o backend com service role acessa.
create table if not exists public.contas_excluidas (
  id uuid primary key default gen_random_uuid(),
  auth_user_id_original uuid not null,
  cpf text not null,
  email text,
  nome text not null,
  telefone text,
  data_nascimento date,
  grupo_id uuid,
  role public.app_role not null default 'comum',
  perfil_snapshot jsonb not null default '{}'::jsonb,
  excluida_por uuid,
  excluida_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '90 days'),
  restaurada_em timestamptz,
  excluida_definitivamente_em timestamptz
);

create index if not exists contas_excluidas_cpf_idx on public.contas_excluidas(cpf);
create index if not exists contas_excluidas_email_idx on public.contas_excluidas(lower(email));
create index if not exists contas_excluidas_expira_idx on public.contas_excluidas(expira_em);

alter table public.contas_excluidas enable row level security;
grant all on public.contas_excluidas to service_role;

comment on table public.contas_excluidas is
  'Cópia de cadastro e vínculo de grupo por 90 dias para recuperação opcional. Sem acesso pelo cliente.';
