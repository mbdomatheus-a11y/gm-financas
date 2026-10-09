create table if not exists public.links_admin (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 120),
  conteudo text not null check (char_length(conteudo) between 1 and 100000),
  tipo text not null check (tipo in ('temporario','permanente')),
  expira_em timestamptz,
  arquivado boolean not null default false,
  criado_por uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint links_admin_expira_coerente check ((tipo = 'temporario' and expira_em is not null) or (tipo = 'permanente' and expira_em is null))
);
alter table public.links_admin enable row level security;
-- Sem policies: nenhum acesso direto pelo navegador. Tudo passa por funções de servidor (service_role) que checam login e admin.
revoke all on public.links_admin from anon, authenticated;
grant all on public.links_admin to service_role;

insert into public.modulos_globais(modulo,nome,habilitado) values ('links','Links',false) on conflict(modulo) do nothing;
