-- Regra do ciclo do GRUPO (08/11/2026). Especificação: docs/regra-ciclo-2026-11-08.md
-- "O salário do dia D paga as contas que vencem até o próximo dia D. O que sobrar no dia D é economia."
-- Idempotente: pode rodar mais de uma vez.

-- 1. Regra do ciclo por grupo (painel compartilhado). Qualquer membro configura ou altera; ninguém apaga.
create table if not exists public.regra_ciclo_grupo (
  grupo_id uuid primary key default private.meu_grupo_id(),
  dia_virada int not null check (dia_virada between 1 and 28),
  dia_anterior int null,
  configurado_por uuid null,
  configurado_por_nome text null,
  configurado_em timestamptz not null default now(),
  atualizado_por uuid null,
  atualizado_por_nome text null,
  atualizado_em timestamptz not null default now()
);
alter table public.regra_ciclo_grupo add column if not exists dia_anterior int null;
alter table public.regra_ciclo_grupo add column if not exists configurado_por_nome text null;
alter table public.regra_ciclo_grupo add column if not exists atualizado_por_nome text null;
alter table public.regra_ciclo_grupo enable row level security;

drop policy if exists regra_ciclo_grupo_select on public.regra_ciclo_grupo;
create policy regra_ciclo_grupo_select on public.regra_ciclo_grupo for select to authenticated
  using (grupo_id = private.meu_grupo_id());
drop policy if exists regra_ciclo_grupo_insert on public.regra_ciclo_grupo;
create policy regra_ciclo_grupo_insert on public.regra_ciclo_grupo for insert to authenticated
  with check (grupo_id = private.meu_grupo_id());
drop policy if exists regra_ciclo_grupo_update on public.regra_ciclo_grupo;
create policy regra_ciclo_grupo_update on public.regra_ciclo_grupo for update to authenticated
  using (grupo_id = private.meu_grupo_id()) with check (grupo_id = private.meu_grupo_id());
revoke delete on public.regra_ciclo_grupo from authenticated;
grant select, insert, update on public.regra_ciclo_grupo to authenticated;
grant all on public.regra_ciclo_grupo to service_role;

-- Quem configurou / alterou e quando (preenchido no banco, não pelo navegador).
create or replace function private.regra_ciclo_grupo_autoria()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  nome_ator text;
begin
  select coalesce(nullif(p.nome, ''), p.email) into nome_ator from public.profiles p where p.id = auth.uid();
  if tg_op = 'INSERT' then
    new.configurado_por := coalesce(auth.uid(), new.configurado_por);
    new.configurado_por_nome := coalesce(nome_ator, new.configurado_por_nome);
    new.configurado_em := now();
  else
    new.configurado_por := old.configurado_por;
    new.configurado_por_nome := old.configurado_por_nome;
    new.configurado_em := old.configurado_em;
    if new.dia_virada is distinct from old.dia_virada then
      new.dia_anterior := old.dia_virada;
    else
      new.dia_anterior := old.dia_anterior;
    end if;
  end if;
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  new.atualizado_por_nome := coalesce(nome_ator, new.atualizado_por_nome);
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_regra_ciclo_grupo_autoria on public.regra_ciclo_grupo;
create trigger trg_regra_ciclo_grupo_autoria before insert or update on public.regra_ciclo_grupo
  for each row execute function private.regra_ciclo_grupo_autoria();

-- Aviso para os outros membros: "Fulano mudou a virada para o dia N" (tabela notificacoes_usuario).
create or replace function private.regra_ciclo_grupo_avisar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dia_virada is distinct from old.dia_virada then
    insert into public.notificacoes_usuario (user_id, tipo, titulo, mensagem, referencia_tipo, referencia_id)
    select p.id, 'regra_ciclo', 'Ciclo do mês alterado',
           coalesce(new.atualizado_por_nome, 'Alguém do grupo') || ' mudou a virada para o dia ' || new.dia_virada || '.',
           'regra_ciclo_grupo', new.grupo_id
      from public.profiles p
     where p.grupo_id = new.grupo_id and p.id is distinct from auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_regra_ciclo_grupo_avisar on public.regra_ciclo_grupo;
create trigger trg_regra_ciclo_grupo_avisar after update on public.regra_ciclo_grupo
  for each row execute function private.regra_ciclo_grupo_avisar();

-- 2. Cartões: revisão da regra (em que ciclo a fatura cai). Se o vencimento mudar, pede revisão de novo.
alter table public.cartoes add column if not exists regra_revisada_em timestamptz null;
alter table public.cartoes add column if not exists vencimento_revisado int null;

-- 3. Resultado dos ciclos fechados (economia). Gravado na primeira abertura após a virada.
create table if not exists public.economia_ciclos (
  grupo_id uuid not null default private.meu_grupo_id(),
  ciclo_inicio date not null,
  ciclo_fim date not null,
  valor_centavos bigint not null,
  calculado_em timestamptz not null default now(),
  primary key (grupo_id, ciclo_inicio)
);
alter table public.economia_ciclos enable row level security;
drop policy if exists economia_ciclos_grupo on public.economia_ciclos;
create policy economia_ciclos_grupo on public.economia_ciclos for all to authenticated
  using (grupo_id = private.meu_grupo_id()) with check (grupo_id = private.meu_grupo_id());
revoke delete on public.economia_ciclos from authenticated;
grant select, insert, update on public.economia_ciclos to authenticated;
grant all on public.economia_ciclos to service_role;

-- 4. Dados atuais: grava a regra só quando TODOS os membros do grupo têm a mesma virada nas preferências.
-- Grupos com viradas diferentes (ou membro sem virada) ficam sem regra: o assistente pergunta ao entrar.
insert into public.regra_ciclo_grupo (grupo_id, dia_virada, configurado_por_nome, atualizado_por_nome)
select m.grupo_id, min(pu.dia_virada), 'Migração automática', 'Migração automática'
  from public.profiles m
  left join public.preferencias_usuario pu on pu.user_id = m.id
 where m.grupo_id is not null
 group by m.grupo_id
having count(*) = count(pu.dia_virada)
   and count(distinct pu.dia_virada) = 1
   and min(pu.dia_virada) between 1 and 28
on conflict (grupo_id) do nothing;

notify pgrst, 'reload schema';
