-- Métricas quantitativas de armazenamento, sem expor nomes ou conteúdo dos arquivos.
-- Objetos criados com service role não têm owner_id e aparecem como não atribuídos.
create or replace view public.admin_uso_arquivos as
select
  case
    when owner_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then owner_id::uuid
    else null::uuid
  end as user_id,
  count(*)::bigint as arquivos,
  coalesce(sum(case
    when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint
    else 0::bigint
  end), 0)::bigint as bytes
from storage.objects
where bucket_id <> 'site_assets'
group by 1;

revoke all on public.admin_uso_arquivos from public, anon, authenticated;
grant select on public.admin_uso_arquivos to service_role;

comment on view public.admin_uso_arquivos is
  'Quantidade e bytes de arquivos por owner_id, acessíveis somente ao backend administrativo.';

notify pgrst, 'reload schema';
