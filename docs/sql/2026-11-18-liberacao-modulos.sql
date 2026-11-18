-- 18/11/2026: interruptores no servidor para escalar sem custo. A funcionalidade vai na versão da loja desligada
-- e é liberada daqui: para testadores, para uma porcentagem das pessoas ou para todos. Sem atualizar o app.
alter table public.modulos_globais add column if not exists liberado_testadores boolean not null default false;
alter table public.modulos_globais add column if not exists percentual smallint not null default 0;
do $$ begin
  alter table public.modulos_globais add constraint modulos_globais_percentual_ck check (percentual between 0 and 100);
exception when duplicate_object then null; end $$;

-- Testadores (você e os amigos): veem os módulos marcados "liberado para testadores".
create table if not exists public.testadores_app (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  criado_por uuid
);
alter table public.testadores_app enable row level security;
drop policy if exists testadores_app_le_proprio on public.testadores_app;
create policy testadores_app_le_proprio on public.testadores_app for select using (user_id = auth.uid());
-- Escrita só pelo servidor do site (administração, com a chave de serviço).
