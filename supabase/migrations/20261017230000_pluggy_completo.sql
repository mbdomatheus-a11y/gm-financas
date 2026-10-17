-- Importação completa: histórico, investimentos, empréstimos e dados da conta.
-- Primeira importação de cada conexão: tudo entra congelado (não pode ser editado nem excluído).
alter table public.pluggy_items add column if not exists sincronizado_em timestamptz;
alter table public.despesas add column if not exists congelada boolean not null default false;
alter table public.pluggy_contas add column if not exists numero_conta text;
alter table public.pluggy_contas add column if not exists titular text;
alter table public.pluggy_contas add column if not exists dados jsonb;

create table if not exists public.pluggy_investimentos (
  id text primary key,
  user_id uuid not null,
  item_id text not null,
  nome text,
  tipo text,
  instituicao text,
  saldo numeric(16,2),
  valor_aplicado numeric(16,2),
  rentabilidade_anual numeric(10,4),
  vencimento date,
  dados jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.pluggy_investimentos enable row level security;
revoke all on public.pluggy_investimentos from anon, authenticated;

create table if not exists public.pluggy_emprestimos (
  id text primary key,
  user_id uuid not null,
  item_id text not null,
  tipo text,
  instituicao text,
  valor_contratado numeric(16,2),
  saldo_devedor numeric(16,2),
  taxa_anual numeric(10,4),
  indexador text,
  vencimento date,
  dados jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.pluggy_emprestimos enable row level security;
revoke all on public.pluggy_emprestimos from anon, authenticated;

create or replace function public.congelar_despesa_pluggy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.origem = 'pluggy' and (OLD.congelada or (OLD.importada_em is not null and OLD.importada_em < now() - interval '30 days')) then
    raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

create or replace function public.congelar_parcela_pluggy()
returns trigger language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select origem, congelada, importada_em into d from public.despesas where id = OLD.despesa_id;
  if d.origem = 'pluggy' and (d.congelada or (d.importada_em is not null and d.importada_em < now() - interval '30 days')) then
    raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
