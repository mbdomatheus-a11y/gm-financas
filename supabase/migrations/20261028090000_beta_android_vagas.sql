-- Beta do Android (28/10/2026): até 50 vagas reservadas pelo site (o Google Groups não tem limite próprio).
create table if not exists public.beta_android_inscricoes (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.beta_android_inscricoes enable row level security;
create policy beta_android_le_proprio on public.beta_android_inscricoes for select to authenticated using (user_id = auth.uid());
create or replace function public.vagas_beta_android() returns integer
language sql security definer set search_path to 'public' stable as $$ select count(*)::int from public.beta_android_inscricoes $$;
revoke all on function public.vagas_beta_android() from public;
grant execute on function public.vagas_beta_android() to anon, authenticated;
create or replace function public.reservar_vaga_beta_android() returns text
language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if auth.uid() is null then return 'sem_login'; end if;
  if exists (select 1 from public.beta_android_inscricoes where user_id = auth.uid()) then return 'ja_reservada'; end if;
  perform pg_advisory_xact_lock(hashtext('beta_android'));
  select count(*) into n from public.beta_android_inscricoes;
  if n >= 50 then return 'lotado'; end if;
  insert into public.beta_android_inscricoes (user_id) values (auth.uid());
  return 'reservada';
end; $$;
revoke all on function public.reservar_vaga_beta_android() from public, anon;
grant execute on function public.reservar_vaga_beta_android() to authenticated;
-- Interruptor do admin: abre as vagas do beta Android no site quando o Google aprovar o teste fechado.
alter table public.configuracoes_acesso_site add column if not exists beta_android_aberto boolean not null default false;
