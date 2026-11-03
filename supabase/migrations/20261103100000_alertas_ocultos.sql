-- 03/11/2026: alertas limpos pelo usuário (somem da lista, o histórico continua).
-- Aditivo. Mesma regra de alertas_lidos: cada usuário só vê e altera os próprios registros.
create table if not exists public.alertas_ocultos (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave text not null,
  ocultado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

alter table public.alertas_ocultos enable row level security;

create policy alertas_ocultos_proprio on public.alertas_ocultos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, delete on public.alertas_ocultos to authenticated;
grant all on public.alertas_ocultos to service_role;

-- 03/11/2026: perguntas de objetivos e dores (uma vez para cada usuário; pode pular).
-- Respostas guardadas para uso futuro, inclusive e-mails sobre as dores de cada pessoa.
create table if not exists public.pesquisa_dores (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  objetivos text[] not null default '{}',
  dores text[] not null default '{}',
  paga_app_financas boolean,
  app_financas_nome text,
  pulou boolean not null default false,
  respondido_em timestamptz not null default now()
);

alter table public.pesquisa_dores enable row level security;

create policy pesquisa_dores_proprio on public.pesquisa_dores
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.pesquisa_dores to authenticated;
grant all on public.pesquisa_dores to service_role;
