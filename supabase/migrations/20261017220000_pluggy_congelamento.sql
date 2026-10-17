-- Lançamento importado pela API fica congelado 30 dias depois da importação: sem edição nem exclusão.
-- A trava vale no banco de dados (despesas e parcelas), não só na tela.
alter table public.despesas add column if not exists importada_em timestamptz;
update public.despesas set importada_em = created_at where origem = 'pluggy' and importada_em is null;

create or replace function public.congelar_despesa_pluggy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.origem = 'pluggy' and OLD.importada_em is not null and OLD.importada_em < now() - interval '30 days' then
    raise exception 'Lançamento importado pelo banco há mais de 30 dias e está congelado. Não pode ser alterado nem excluído.'
      using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists congelar_despesa_pluggy on public.despesas;
create trigger congelar_despesa_pluggy
  before update or delete on public.despesas
  for each row execute function public.congelar_despesa_pluggy();

create or replace function public.congelar_parcela_pluggy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  select origem, importada_em into d from public.despesas where id = OLD.despesa_id;
  if d.origem = 'pluggy' and d.importada_em is not null and d.importada_em < now() - interval '30 days' then
    raise exception 'Lançamento importado pelo banco há mais de 30 dias e está congelado. Não pode ser alterado nem excluído.'
      using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists congelar_parcela_pluggy on public.parcelas;
create trigger congelar_parcela_pluggy
  before update or delete on public.parcelas
  for each row execute function public.congelar_parcela_pluggy();
