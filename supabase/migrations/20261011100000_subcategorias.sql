-- Subcategorias cadastradas pelos usuários, ligadas a uma macro categoria.
-- As macros padrão continuam em categorias_padrao (array subcategorias);
-- aqui ficam as subcategorias criadas depois, sem alterar o padrão.
-- Mesma política de acesso de categorias: o cadastro é compartilhado no site.
create table if not exists public.subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  nome text not null,
  tipo text not null default 'despesa' check (tipo in ('receita','despesa')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (tipo, categoria, nome)
);

grant select, insert, update, delete on public.subcategorias to authenticated;
grant all on public.subcategorias to service_role;
alter table public.subcategorias enable row level security;
create policy "subcategorias_all" on public.subcategorias
  for all to authenticated using (true) with check (true);
