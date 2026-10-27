-- Diagnóstico do app (27/10/2026): erros de tela gravados pelo próprio app (sem dados financeiros).
create table if not exists public.app_erros (
  id bigserial primary key,
  user_id uuid default auth.uid(),
  plataforma text,
  versao text,
  tela text,
  mensagem text not null,
  pilha text,
  fatal boolean default false,
  criado_em timestamptz not null default now()
);
alter table public.app_erros enable row level security;
create policy app_erros_insere_proprio on public.app_erros for insert to authenticated with check (user_id = auth.uid());
create policy app_erros_admin_le on public.app_erros for select to authenticated using (exists (select 1 from public.site_admins s where s.user_id = auth.uid()));
create index if not exists app_erros_criado_idx on public.app_erros (criado_em desc);
