-- 02/11/2026: agrupamentos e arquivo para notas fiscais.
-- Tudo aditivo. Não cria lançamento em despesas, receitas ou faturas:
-- a nota continua fora do módulo financeiro.

-- Agrupamentos próprios de notas (ex.: Casa, Carro, Eletrônicos).
create table if not exists public.notas_grupos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid references public.grupos(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (grupo_id, nome)
);

create trigger set_grupo_id_trigger before insert on public.notas_grupos
  for each row execute function private.set_grupo_id();

alter table public.notas_grupos enable row level security;

create policy notas_grupos_do_grupo on public.notas_grupos
  for all to authenticated
  using (grupo_id = private.meu_grupo_id())
  with check (grupo_id = private.meu_grupo_id());

create policy notas_grupos_bloqueio_total on public.notas_grupos
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

grant select, insert, update, delete on public.notas_grupos to authenticated;
grant all on public.notas_grupos to service_role;

-- Campos novos na nota.
alter table public.notas_fiscais
  add column if not exists nota_grupo_id uuid references public.notas_grupos(id) on delete set null,
  add column if not exists arquivada boolean not null default false,
  add column if not exists arquivada_em timestamptz,
  add column if not exists so_guardar boolean not null default false;

create index if not exists notas_fiscais_grupo_arquivada_idx
  on public.notas_fiscais (grupo_id, arquivada);
