-- Importação automática Pluggy: lançamentos da API entram em despesas já aprovados (o usuário pode rejeitar).
-- Regras:
--  * conta/cartão conectado por API bloqueia lançamento manual no mesmo cartão (ou banco);
--  * lançamento vindo da API substitui o manual equivalente do passado (mesmo cartão, data e valor);
--  * remover a conexão libera o manual de novo.

alter table public.despesas add column if not exists pluggy_transaction_id text unique;

alter table public.pluggy_transacoes add column if not exists rejeitada boolean not null default false;
alter table public.pluggy_transacoes add column if not exists substituiu_manual boolean not null default false;

create table if not exists public.pluggy_contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  grupo_id uuid,
  item_id text not null,
  account_id text not null unique,
  tipo text not null,
  nome text,
  cartao_final text,
  banco_id uuid,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table public.pluggy_contas enable row level security;
revoke all on public.pluggy_contas from anon, authenticated;

-- Trava: lançamento manual em cartão com conta automática ativa é recusado pelo banco de dados.
create or replace function public.bloquear_manual_conta_pluggy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.origem in ('manual', 'fatura_rapida', 'fatura_total_manual') then
    if NEW.cartao_id is not null and exists (
      select 1
      from public.pluggy_contas c
      join public.cartoes k on k.id = NEW.cartao_id
      where c.ativo and c.tipo = 'CREDIT' and c.cartao_final = k.final
        and c.grupo_id is not distinct from k.grupo_id
    ) then
      raise exception 'Este cartão é importado automaticamente pelo banco. Lance pelas transações importadas ou desconecte o banco.'
        using errcode = 'P0001';
    end if;
    if NEW.banco_id is not null and exists (
      select 1 from public.pluggy_contas c where c.ativo and c.banco_id = NEW.banco_id
    ) then
      raise exception 'Esta conta é importada automaticamente pelo banco. Lance pelas transações importadas ou desconecte o banco.'
        using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bloquear_manual_conta_pluggy on public.despesas;
create trigger bloquear_manual_conta_pluggy
  before insert on public.despesas
  for each row execute function public.bloquear_manual_conta_pluggy();
