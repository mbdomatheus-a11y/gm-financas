-- Mesma exceção autorizada para parcelas: despesa bancária já copiada para arquivo_open_finance pode sair.
-- Qualquer outro lançamento importado e congelado continua protegido.
create or replace function public.congelar_despesa_pluggy()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if OLD.origem = 'pluggy'
     and (OLD.congelada or (OLD.importada_em is not null and OLD.importada_em < now() - interval '30 days'))
     and not exists (
       select 1 from public.arquivo_open_finance a
       where a.tabela_origem = 'despesas' and a.registro_id = OLD.id
     )
  then
    raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$function$;
