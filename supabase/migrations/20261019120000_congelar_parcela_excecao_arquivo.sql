-- Autorizado pelo administrador: lançamento bancário já copiado para arquivo_open_finance pode sair das
-- tabelas de uso. Qualquer outro lançamento importado e congelado continua protegido.
create or replace function public.congelar_parcela_pluggy()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare d record;
begin
  select origem, congelada, importada_em into d from public.despesas where id = OLD.despesa_id;
  if d.origem = 'pluggy'
     and (d.congelada or (d.importada_em is not null and d.importada_em < now() - interval '30 days'))
     and not exists (
       select 1 from public.arquivo_open_finance a
       where a.tabela_origem = 'despesas' and a.registro_id = OLD.despesa_id
     )
  then
    raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$function$;
