-- Volta as travas de lançamento importado pelo banco à regra original (sem exceção de arquivo),
-- depois da remoção dos lançamentos bancários já arquivados.
create or replace function public.congelar_parcela_pluggy()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$ declare d record; begin select origem, congelada, importada_em into d from public.despesas where id = OLD.despesa_id; if d.origem = 'pluggy' and (d.congelada or (d.importada_em is not null and d.importada_em < now() - interval '30 days')) then raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001'; end if; if TG_OP = 'DELETE' then return OLD; end if; return NEW; end; $function$;

create or replace function public.congelar_despesa_pluggy()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$ begin if OLD.origem = 'pluggy' and (OLD.congelada or (OLD.importada_em is not null and OLD.importada_em < now() - interval '30 days')) then raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001'; end if; if TG_OP = 'DELETE' then return OLD; end if; return NEW; end; $function$;
