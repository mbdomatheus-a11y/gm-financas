-- Atalho do iPhone (15/11/2026): lançar um gasto sem abrir o app (Siri, Botão de Ação, widget do Atalhos).
-- Cada pessoa gera um código pessoal; o servidor guarda só o hash. Gerar de novo invalida o anterior.
create table if not exists public.atalho_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique,
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  usos integer not null default 0
);
alter table public.atalho_tokens enable row level security;
-- Sem policy de propósito: leitura e gravação só pelas funções abaixo e pelo servidor.

create or replace function public.gerar_token_atalho()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  t text;
begin
  if u is null then raise exception 'Sessão inválida. Entre de novo.'; end if;
  t := 'ca_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into atalho_tokens (user_id, token_hash, criado_em, ultimo_uso_em, usos)
  values (u, encode(extensions.digest(t, 'sha256'), 'hex'), now(), null, 0)
  on conflict (user_id) do update set token_hash = excluded.token_hash, criado_em = now(), ultimo_uso_em = null, usos = 0;
  return t;
end;
$$;

create or replace function public.revogar_token_atalho()
returns void
language sql
security definer
set search_path = public
as $$ delete from atalho_tokens where user_id = auth.uid(); $$;

create or replace function public.meu_atalho()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('ativo', true, 'criado_em', criado_em, 'ultimo_uso_em', ultimo_uso_em, 'usos', usos)
       from atalho_tokens where user_id = auth.uid()),
    jsonb_build_object('ativo', false)
  );
$$;

revoke all on function public.gerar_token_atalho() from public, anon;
revoke all on function public.revogar_token_atalho() from public, anon;
revoke all on function public.meu_atalho() from public, anon;
grant execute on function public.gerar_token_atalho() to authenticated;
grant execute on function public.revogar_token_atalho() to authenticated;
grant execute on function public.meu_atalho() to authenticated;
