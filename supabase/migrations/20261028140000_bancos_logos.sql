-- Logos oficiais de todos os bancos (28/10/2026): catálogo da Pluggy guardado aqui, para o site e o app
-- mostrarem o logo de qualquer banco cadastrado, mesmo sem conexão de Open Finance.
create table if not exists public.bancos_logos (
  chave text primary key,
  nome text not null,
  logo_url text not null,
  cor text,
  tipo text,
  atualizado_em timestamptz not null default now()
);
alter table public.bancos_logos enable row level security;
drop policy if exists "logos de bancos visíveis para quem está logado" on public.bancos_logos;
create policy "logos de bancos visíveis para quem está logado" on public.bancos_logos for select to authenticated using (true);
revoke insert, update, delete on public.bancos_logos from anon, authenticated;
