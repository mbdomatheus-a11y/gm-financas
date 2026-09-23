create table if not exists public.configuracoes_acesso_site (
  id boolean primary key default true check (id),
  modo_login text not null default 'ambos' check (modo_login in ('cpf','email','ambos')),
  segundo_fator_email boolean not null default false,
  sessao_maxima_minutos integer not null default 60 check (sessao_maxima_minutos between 15 and 480),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
insert into public.configuracoes_acesso_site(id) values(true) on conflict(id) do nothing;
alter table public.configuracoes_acesso_site enable row level security;
create policy configuracoes_acesso_leitura on public.configuracoes_acesso_site for select using (true);
grant select on public.configuracoes_acesso_site to anon, authenticated;
grant all on public.configuracoes_acesso_site to service_role;

create table if not exists public.modulos_globais (
  modulo text primary key,
  nome text not null,
  habilitado boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
insert into public.modulos_globais(modulo,nome) values
 ('financas','Finanças'),('lista','Lista'),('notas','Notas'),('calculadora','Calculadora'),
 ('pet','Pet'),('onde_esta','Onde está?'),('veiculo','Veículo'),('exames','Exames')
on conflict(modulo) do nothing;
alter table public.modulos_globais enable row level security;
create policy modulos_globais_leitura on public.modulos_globais for select to authenticated using (true);
grant select on public.modulos_globais to authenticated;
grant all on public.modulos_globais to service_role;

create table if not exists public.modulos_usuario (
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null references public.modulos_globais(modulo) on delete cascade,
  habilitado boolean not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  primary key(user_id,modulo)
);
alter table public.modulos_usuario enable row level security;
create policy modulos_usuario_proprio on public.modulos_usuario for select to authenticated using (user_id=auth.uid());
grant select on public.modulos_usuario to authenticated;
grant all on public.modulos_usuario to service_role;

create table if not exists public.login_2fa_desafios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo_hash text not null,
  tentativas integer not null default 0 check (tentativas between 0 and 5),
  expira_em timestamptz not null default now() + interval '10 minutes',
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.login_2fa_desafios enable row level security;
revoke all on public.login_2fa_desafios from anon, authenticated;
grant all on public.login_2fa_desafios to service_role;

create table if not exists public.alertas_lidos (
  user_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,
  lido_em timestamptz not null default now(),
  primary key(user_id,chave)
);
alter table public.alertas_lidos enable row level security;
create policy alertas_lidos_proprio on public.alertas_lidos for all to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.alertas_lidos to authenticated;

create table if not exists public.bloqueio_conta_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expira_em timestamptz not null default now() + interval '24 hours',
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.bloqueio_conta_tokens enable row level security;
revoke all on public.bloqueio_conta_tokens from anon, authenticated;
grant all on public.bloqueio_conta_tokens to service_role;

create table if not exists public.convites_grupo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  criado_por uuid not null references auth.users(id) on delete cascade,
  email_destino text not null,
  token_hash text not null unique,
  status text not null default 'pendente' check(status in ('pendente','aceito','recusado','cancelado','expirado')),
  expira_em timestamptz not null default now() + interval '7 days',
  respondido_por uuid references auth.users(id) on delete set null,
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.convites_grupo enable row level security;
revoke all on public.convites_grupo from anon, authenticated;
grant all on public.convites_grupo to service_role;

create or replace function public.aceitar_convite_grupo(p_token text)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare v_convite public.convites_grupo%rowtype; v_origem uuid; v_tabela record;
begin
  select * into v_convite from public.convites_grupo
   where token_hash=encode(digest(p_token,'sha256'),'hex') and status='pendente' and expira_em>now() for update;
  if v_convite.id is null then raise exception 'Convite inválido ou expirado'; end if;
  if lower(coalesce(auth.jwt()->>'email','')) <> lower(v_convite.email_destino) then raise exception 'Este convite foi enviado para outro e-mail'; end if;
  select grupo_id into v_origem from public.profiles where id=auth.uid() and ativo=true;
  if v_origem is null then raise exception 'Grupo atual não encontrado'; end if;
  if v_origem=v_convite.grupo_id then raise exception 'Você já participa deste grupo'; end if;
  if (select count(*) from public.profiles where grupo_id=v_origem and ativo=true)>1 then raise exception 'Seu grupo atual possui outros integrantes. A união exige que eles saiam ou aceitem uma migração conjunta.'; end if;
  for v_tabela in select distinct c.conrelid::regclass::text tabela from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='f' and c.confrelid='public.grupos'::regclass and a.attname='grupo_id' and c.conrelid<>'public.profiles'::regclass loop
    execute format('update %s set grupo_id=$1 where grupo_id=$2',v_tabela.tabela) using v_convite.grupo_id,v_origem;
  end loop;
  update public.profiles set grupo_id=v_convite.grupo_id where id=auth.uid();
  update public.convites_grupo set status='aceito',respondido_por=auth.uid(),respondido_em=now() where id=v_convite.id;
  if not exists(select 1 from public.profiles where grupo_id=v_origem) then delete from public.grupos where id=v_origem; end if;
  return v_convite.grupo_id;
end;$$;
revoke all on function public.aceitar_convite_grupo(text) from public,anon;
grant execute on function public.aceitar_convite_grupo(text) to authenticated;

alter table public.comunicados alter column expira_em set default (now() + interval '72 hours');
update public.comunicados set expira_em=criado_em + interval '72 hours' where expira_em is null;

notify pgrst, 'reload schema';
