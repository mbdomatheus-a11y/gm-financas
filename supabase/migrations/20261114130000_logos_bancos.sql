-- Logos dos bancos (14/11/2026): catálogo no banco de dados + bucket público "logos-bancos".
-- chave = id do catálogo (slug do nome, ver idBanco em src/lib/bancos-catalogo.ts).
-- origem 'automatico': o servidor busca o ícone no domínio toda semana. 'admin': escolhido na Administração, nunca sobrescrito.
create table if not exists public.logos_bancos (
  chave text primary key,
  nome text not null,
  dominio text,
  cor text,
  apelidos text[] not null default '{}',
  personalizado boolean not null default false, -- true: banco adicionado pelo admin (fora do catálogo do código)
  logo_path text,
  origem text not null default 'automatico',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
alter table public.logos_bancos add column if not exists apelidos text[] not null default '{}';
alter table public.logos_bancos add column if not exists personalizado boolean not null default false;
do $$ begin
  alter table public.logos_bancos add constraint logos_bancos_origem_check check (origem in ('automatico', 'admin'));
exception when duplicate_object then null;
end $$;

alter table public.logos_bancos enable row level security;
drop policy if exists logos_bancos_leitura on public.logos_bancos;
create policy logos_bancos_leitura on public.logos_bancos for select to authenticated using (true);
drop policy if exists logos_bancos_admin_insert on public.logos_bancos;
create policy logos_bancos_admin_insert on public.logos_bancos for insert to authenticated
  with check (private.is_admin(auth.uid()));
drop policy if exists logos_bancos_admin_update on public.logos_bancos;
create policy logos_bancos_admin_update on public.logos_bancos for update to authenticated
  using (private.is_admin(auth.uid())) with check (private.is_admin(auth.uid()));
drop policy if exists logos_bancos_admin_delete on public.logos_bancos;
create policy logos_bancos_admin_delete on public.logos_bancos for delete to authenticated
  using (private.is_admin(auth.uid()));
grant select on public.logos_bancos to authenticated;
grant insert, update, delete on public.logos_bancos to authenticated;

-- Bucket público de leitura: só imagens pequenas (png, svg, webp) até 200 KB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos-bancos', 'logos-bancos', true, 204800, array['image/png', 'image/svg+xml', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_bancos_storage_leitura on storage.objects;
create policy logos_bancos_storage_leitura on storage.objects for select
  using (bucket_id = 'logos-bancos');
drop policy if exists logos_bancos_storage_admin_insert on storage.objects;
create policy logos_bancos_storage_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos-bancos' and private.is_admin(auth.uid()));
drop policy if exists logos_bancos_storage_admin_update on storage.objects;
create policy logos_bancos_storage_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'logos-bancos' and private.is_admin(auth.uid()))
  with check (bucket_id = 'logos-bancos' and private.is_admin(auth.uid()));
drop policy if exists logos_bancos_storage_admin_delete on storage.objects;
create policy logos_bancos_storage_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos-bancos' and private.is_admin(auth.uid()));

-- Atualização pelo pg_cron (mesmo padrão do controlall-alertas-hora): roda todo dia 04:17 UTC e o servidor
-- renova só os logos automáticos com mais de 6 dias, então cada banco é atualizado uma vez por semana.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'controlall-logos-bancos-semanal';
    perform cron.schedule('controlall-logos-bancos-semanal', '17 4 * * *',
      $job$select private.chamar_servidor('/api/cron/logos-bancos', '{}'::jsonb)$job$);
  end if;
exception when others then raise notice 'Agendamento do pg_cron não criado: %', sqlerrm;
end $$;
