-- 07/11/2026: módulo Contas (contas bancárias e carteira com saldo) e transferências entre contas.
--
-- IMPORTANTE: o usuário roda esta migration manualmente, com backup feito antes.
-- Tudo é aditivo e idempotente (pode rodar de novo sem quebrar): só cria tabelas, colunas,
-- índices, triggers e policies que ainda não existem. Não altera nem apaga dados.
--
-- Padrão do projeto: cada linha pertence a um grupo (grupo_id), preenchido pelo trigger
-- private.set_grupo_id() e protegido pela policy grupo_id = private.meu_grupo_id().
-- user_id guarda quem criou (default auth.uid()).

-- 1) Contas bancárias e carteira
create table if not exists public.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  nome text not null,
  tipo text not null default 'corrente'
    check (tipo in ('corrente', 'poupanca', 'carteira', 'investimento', 'outra')),
  banco_id uuid references public.bancos(id) on delete set null,
  saldo_inicial numeric(14,2) not null default 0,
  data_saldo_inicial date not null default current_date,
  cor text,
  arquivada boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contas_bancarias_user_idx on public.contas_bancarias (user_id);
create index if not exists contas_bancarias_grupo_idx on public.contas_bancarias (grupo_id, arquivada);

-- 2) Transferências entre contas
create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  conta_origem_id uuid not null references public.contas_bancarias(id) on delete cascade,
  conta_destino_id uuid not null references public.contas_bancarias(id) on delete cascade,
  valor numeric(14,2) not null check (valor > 0),
  data date not null default current_date,
  descricao text,
  created_at timestamptz not null default now(),
  constraint transferencias_origem_destino_diferentes check (conta_origem_id <> conta_destino_id)
);

create index if not exists transferencias_user_idx on public.transferencias (user_id);
create index if not exists transferencias_grupo_data_idx on public.transferencias (grupo_id, data desc);
create index if not exists transferencias_origem_idx on public.transferencias (conta_origem_id);
create index if not exists transferencias_destino_idx on public.transferencias (conta_destino_id);

-- 3) Triggers (grupo e updated_at)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_grupo_id_trigger' and tgrelid = 'public.contas_bancarias'::regclass) then
    create trigger set_grupo_id_trigger before insert on public.contas_bancarias
      for each row execute function private.set_grupo_id();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.contas_bancarias'::regclass) then
    create trigger set_updated_at before update on public.contas_bancarias
      for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_grupo_id_trigger' and tgrelid = 'public.transferencias'::regclass) then
    create trigger set_grupo_id_trigger before insert on public.transferencias
      for each row execute function private.set_grupo_id();
  end if;
end $$;

-- 4) RLS no mesmo padrão das outras tabelas do grupo
alter table public.contas_bancarias enable row level security;
alter table public.transferencias enable row level security;

drop policy if exists contas_bancarias_do_grupo on public.contas_bancarias;
create policy contas_bancarias_do_grupo on public.contas_bancarias
  for all to authenticated
  using (grupo_id = private.meu_grupo_id())
  with check (grupo_id = private.meu_grupo_id());

drop policy if exists contas_bancarias_bloqueio_total on public.contas_bancarias;
create policy contas_bancarias_bloqueio_total on public.contas_bancarias
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists transferencias_do_grupo on public.transferencias;
create policy transferencias_do_grupo on public.transferencias
  for all to authenticated
  using (grupo_id = private.meu_grupo_id())
  with check (grupo_id = private.meu_grupo_id());

drop policy if exists transferencias_bloqueio_total on public.transferencias;
create policy transferencias_bloqueio_total on public.transferencias
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

grant select, insert, update, delete on public.contas_bancarias to authenticated;
grant select, insert, update, delete on public.transferencias to authenticated;
grant all on public.contas_bancarias to service_role;
grant all on public.transferencias to service_role;

-- 5) Conta usada no lançamento (futuro "conta ou cartão"). Opcional: nulo = sem conta.
alter table public.despesas
  add column if not exists conta_id uuid references public.contas_bancarias(id) on delete set null;
alter table public.receitas
  add column if not exists conta_id uuid references public.contas_bancarias(id) on delete set null;

create index if not exists despesas_conta_idx on public.despesas (conta_id) where conta_id is not null;
create index if not exists receitas_conta_idx on public.receitas (conta_id) where conta_id is not null;

notify pgrst, 'reload schema';
