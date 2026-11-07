-- 07/11/2026: limites de gastos por categoria, tags em lançamentos e
-- preferências de categoria (oculta / essencial).
--
-- Padrão seguido: dados financeiros são do GRUPO (casa), igual a despesas,
-- categorias, notas_grupos e fatura_correcoes_usuario. O grupo é preenchido
-- pelo trigger private.set_grupo_id() e a RLS usa private.meu_grupo_id().
-- user_id guarda quem criou (default auth.uid()).
--
-- limites_gasto.categoria guarda o NOME da macro categoria, exatamente como
-- despesas.categoria (text). Unicidade por grupo + categoria (o limite vale
-- para a casa toda, como as próprias categorias).
--
-- Tudo idempotente e aditivo: pode rodar mais de uma vez. Não altera dados.

-- 1) Limites de gastos ------------------------------------------------------
create table if not exists public.limites_gasto (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  grupo_id uuid references public.grupos(id) on delete cascade,
  categoria text not null,
  valor_mensal numeric(14,2) not null check (valor_mensal > 0),
  alerta_percentual integer not null default 80 check (alerta_percentual between 1 and 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists limites_gasto_grupo_categoria_uidx
  on public.limites_gasto (grupo_id, lower(categoria));

drop trigger if exists set_grupo_id_trigger on public.limites_gasto;
create trigger set_grupo_id_trigger before insert on public.limites_gasto
  for each row execute function private.set_grupo_id();

drop trigger if exists set_updated_at on public.limites_gasto;
create trigger set_updated_at before update on public.limites_gasto
  for each row execute function public.update_updated_at_column();

alter table public.limites_gasto enable row level security;

drop policy if exists limites_gasto_do_grupo on public.limites_gasto;
create policy limites_gasto_do_grupo on public.limites_gasto
  for all to authenticated
  using (grupo_id = private.meu_grupo_id())
  with check (grupo_id = private.meu_grupo_id());

drop policy if exists limites_gasto_bloqueio_total on public.limites_gasto;
create policy limites_gasto_bloqueio_total on public.limites_gasto
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

grant select, insert, update, delete on public.limites_gasto to authenticated;
grant all on public.limites_gasto to service_role;

-- 2) Tags -------------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  grupo_id uuid references public.grupos(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 40),
  cor text not null default '#1670B8',
  created_at timestamptz not null default now()
);

create unique index if not exists tags_grupo_nome_uidx
  on public.tags (grupo_id, lower(nome));

drop trigger if exists set_grupo_id_trigger on public.tags;
create trigger set_grupo_id_trigger before insert on public.tags
  for each row execute function private.set_grupo_id();

alter table public.tags enable row level security;

drop policy if exists tags_do_grupo on public.tags;
create policy tags_do_grupo on public.tags
  for all to authenticated
  using (grupo_id = private.meu_grupo_id())
  with check (grupo_id = private.meu_grupo_id());

drop policy if exists tags_bloqueio_total on public.tags;
create policy tags_bloqueio_total on public.tags
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

grant select, insert, update, delete on public.tags to authenticated;
grant all on public.tags to service_role;

-- 3) Vínculos tag x despesa / receita -------------------------------------
-- O acesso vale quando a tag é do meu grupo E o lançamento é visível para
-- mim (a subconsulta em despesas/receitas respeita a RLS delas).
create table if not exists public.despesa_tags (
  despesa_id uuid not null references public.despesas(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (despesa_id, tag_id)
);
create index if not exists despesa_tags_tag_idx on public.despesa_tags (tag_id);

alter table public.despesa_tags enable row level security;

drop policy if exists despesa_tags_do_grupo on public.despesa_tags;
create policy despesa_tags_do_grupo on public.despesa_tags
  for all to authenticated
  using (
    exists (select 1 from public.tags t where t.id = tag_id and t.grupo_id = private.meu_grupo_id())
    and exists (select 1 from public.despesas d where d.id = despesa_id)
  )
  with check (
    exists (select 1 from public.tags t where t.id = tag_id and t.grupo_id = private.meu_grupo_id())
    and exists (select 1 from public.despesas d where d.id = despesa_id)
  );

grant select, insert, update, delete on public.despesa_tags to authenticated;
grant all on public.despesa_tags to service_role;

create table if not exists public.receita_tags (
  receita_id uuid not null references public.receitas(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (receita_id, tag_id)
);
create index if not exists receita_tags_tag_idx on public.receita_tags (tag_id);

alter table public.receita_tags enable row level security;

drop policy if exists receita_tags_do_grupo on public.receita_tags;
create policy receita_tags_do_grupo on public.receita_tags
  for all to authenticated
  using (
    exists (select 1 from public.tags t where t.id = tag_id and t.grupo_id = private.meu_grupo_id())
    and exists (select 1 from public.receitas r where r.id = receita_id)
  )
  with check (
    exists (select 1 from public.tags t where t.id = tag_id and t.grupo_id = private.meu_grupo_id())
    and exists (select 1 from public.receitas r where r.id = receita_id)
  );

grant select, insert, update, delete on public.receita_tags to authenticated;
grant all on public.receita_tags to service_role;

-- 4) Preferências de categoria (a tabela categorias é do grupo) -----------
-- oculta: some dos seletores sem apagar o histórico.
-- essencial: true = gasto essencial, false = supérfluo, null = não definido.
alter table public.categorias add column if not exists oculta boolean not null default false;
alter table public.categorias add column if not exists essencial boolean;

notify pgrst, 'reload schema';
