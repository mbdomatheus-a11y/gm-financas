-- Receitas importadas pela Pluggy (Open Finance): origem, id da transação e congelamento de 30 dias.
-- Aplicada no Supabase de produção (sem DROP: a migração original foi cancelada e refeita nesta forma).

alter table public.receitas
  add column if not exists origem text not null default 'manual',
  add column if not exists pluggy_transaction_id text,
  add column if not exists importada_em timestamptz,
  add column if not exists congelada boolean not null default false;

alter table public.receitas
  add constraint receitas_origem_check check (origem in ('manual', 'pluggy'));

create unique index if not exists receitas_pluggy_transaction_id_key
  on public.receitas (pluggy_transaction_id)
  where pluggy_transaction_id is not null;

create or replace function public.congelar_receita_pluggy()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if OLD.origem = 'pluggy' and (OLD.congelada or (OLD.importada_em is not null and OLD.importada_em < now() - interval '30 days')) then
    raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$function$;

create trigger congelar_receita_pluggy
  before update or delete on public.receitas
  for each row execute function public.congelar_receita_pluggy();
