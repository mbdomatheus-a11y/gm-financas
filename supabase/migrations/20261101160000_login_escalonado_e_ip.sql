-- 01/11/2026: bloqueio de login escalonado por conta e novo bloqueio por IP.
-- Por conta (e-mail): 3 erros: 1 min; 4: 5 min; 5: 15 min; 6: 1 h; 7 ou mais: 24 h.
-- A contagem zera após 24 h sem erro e com login bem-sucedido.
create or replace function public.registrar_tentativa_login(p_hash text, p_sucesso boolean)
returns table (bloqueado_ate timestamptz, falhas integer)
language plpgsql security definer set search_path = public as $$
declare v_falhas integer; v_bloqueio timestamptz;
begin
  if p_sucesso then
    delete from public.login_tentativas where identificador_hash = p_hash;
    return query select null::timestamptz, 0;
    return;
  end if;
  update public.login_tentativas set falhas = 0, bloqueado_ate = null
    where identificador_hash = p_hash and atualizado_em < now() - interval '24 hours';
  insert into public.login_tentativas as l (identificador_hash, falhas, atualizado_em)
  values (p_hash, 1, now())
  on conflict (identificador_hash) do update
    set falhas = l.falhas + 1, atualizado_em = now()
  returning l.falhas into v_falhas;
  if v_falhas >= 3 then
    v_bloqueio := now() + case
      when v_falhas = 3 then interval '1 minute'
      when v_falhas = 4 then interval '5 minutes'
      when v_falhas = 5 then interval '15 minutes'
      when v_falhas = 6 then interval '1 hour'
      else interval '24 hours' end;
    update public.login_tentativas set bloqueado_ate = v_bloqueio where identificador_hash = p_hash;
  else
    v_bloqueio := null;
  end if;
  return query select v_bloqueio, v_falhas;
end $$;

-- Por IP: conta todas as falhas do IP, inclusive e-mails inexistentes (ataque com muitos usuários).
-- 20 falhas em 15 minutos bloqueiam o IP por 15 min; cada novo bloqueio dobra, até 24 h.
-- Login bem-sucedido não zera o IP (senão um atacante alterna contas válidas para escapar).
create table if not exists public.login_ip_tentativas (
  ip_hash text primary key,
  falhas integer not null default 0,
  janela_inicio timestamptz not null default now(),
  bloqueios integer not null default 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.login_ip_tentativas enable row level security;
grant all on public.login_ip_tentativas to service_role;

create or replace function public.registrar_falha_login_ip(p_ip_hash text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare r public.login_ip_tentativas%rowtype; v_bloqueio timestamptz;
begin
  if p_ip_hash is null then return null; end if;
  insert into public.login_ip_tentativas as l (ip_hash, falhas, janela_inicio, atualizado_em)
  values (p_ip_hash, 1, now(), now())
  on conflict (ip_hash) do update set
    falhas = case when l.janela_inicio < now() - interval '15 minutes' then 1 else l.falhas + 1 end,
    janela_inicio = case when l.janela_inicio < now() - interval '15 minutes' then now() else l.janela_inicio end,
    atualizado_em = now()
  returning * into r;
  if r.falhas >= 20 and (r.bloqueado_ate is null or r.bloqueado_ate <= now()) then
    v_bloqueio := now() + least(make_interval(mins => 15 * power(2, least(r.bloqueios, 8))::int), interval '24 hours');
    update public.login_ip_tentativas
      set bloqueado_ate = v_bloqueio, bloqueios = bloqueios + 1, falhas = 0, janela_inicio = now()
      where ip_hash = p_ip_hash;
    return v_bloqueio;
  end if;
  return r.bloqueado_ate;
end $$;

create or replace function public.ip_bloqueado_login(p_ip_hash text)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select bloqueado_ate from public.login_ip_tentativas
  where ip_hash = p_ip_hash and bloqueado_ate > now();
$$;

revoke all on function public.registrar_falha_login_ip(text) from public, anon, authenticated;
revoke all on function public.ip_bloqueado_login(text) from public, anon, authenticated;
grant execute on function public.registrar_falha_login_ip(text) to service_role;
grant execute on function public.ip_bloqueado_login(text) to service_role;
