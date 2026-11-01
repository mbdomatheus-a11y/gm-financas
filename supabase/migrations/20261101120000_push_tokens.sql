-- Notificações push no iPhone e no Android (01/11/2026). Um registro por aparelho (token da Expo).
create table if not exists public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references auth.users(id) on delete cascade,
  plataforma text not null check (plataforma in ('ios','android')),
  app_versao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_ler_proprio" on public.push_tokens;
create policy "push_tokens_ler_proprio" on public.push_tokens for select to authenticated using (user_id = auth.uid());
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

-- Registrar: o aparelho passa a ser da conta logada (se outra conta usou o mesmo aparelho, deixa de receber).
create or replace function public.registrar_push_token(p_token text, p_plataforma text, p_versao text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if p_plataforma not in ('ios','android') or char_length(coalesce(p_token,'')) not between 10 and 300 then
    raise exception 'dados inválidos';
  end if;
  insert into public.push_tokens (token, user_id, plataforma, app_versao)
  values (p_token, auth.uid(), p_plataforma, left(p_versao, 40))
  on conflict (token) do update set user_id = auth.uid(), plataforma = excluded.plataforma,
    app_versao = excluded.app_versao, atualizado_em = now();
end $$;

-- Remover (ao sair da conta): só o token da própria conta.
create or replace function public.remover_push_token(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end $$;

revoke all on function public.registrar_push_token(text, text, text) from public, anon;
revoke all on function public.remover_push_token(text) from public, anon;
grant execute on function public.registrar_push_token(text, text, text) to authenticated;
grant execute on function public.remover_push_token(text) to authenticated;
