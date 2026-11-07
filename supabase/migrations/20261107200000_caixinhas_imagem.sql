-- 07/11/2026: imagem das caixinhas (tema com foto padrão ou foto do usuário).
-- Depende de 20261107130000_caixinhas_metas.sql (a coluna "imagem" de lá continua sendo o ícone).
--   tema       id do tema (ex.: "viagem", "casa"); a foto padrão vem do catálogo caixinhas-temas.ts
--   foto_path  caminho da foto do usuário no bucket privado "caixinhas" ("<grupo_id>/<arquivo>")
-- Idempotente e aditiva: pode rodar mais de uma vez. Não altera dados existentes.

alter table if exists public.caixinhas add column if not exists tema text;
alter table if exists public.caixinhas add column if not exists foto_path text;

do $$
begin
  if to_regclass('public.caixinhas') is not null
     and not exists (select 1 from pg_constraint where conname = 'caixinhas_tema_tamanho') then
    alter table public.caixinhas add constraint caixinhas_tema_tamanho check (tema is null or length(tema) <= 40);
  end if;
  if to_regclass('public.caixinhas') is not null
     and not exists (select 1 from pg_constraint where conname = 'caixinhas_foto_path_tamanho') then
    alter table public.caixinhas add constraint caixinhas_foto_path_tamanho check (foto_path is null or length(foto_path) <= 200);
  end if;
end $$;

-- Bucket privado: a pasta de cada arquivo é o grupo_id de quem enviou.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('caixinhas', 'caixinhas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists caixinhas_fotos_por_grupo on storage.objects;
create policy caixinhas_fotos_por_grupo on storage.objects
for all to authenticated
using (bucket_id = 'caixinhas' and split_part(name, '/', 1) = private.meu_grupo_id()::text)
with check (bucket_id = 'caixinhas' and split_part(name, '/', 1) = private.meu_grupo_id()::text);

notify pgrst, 'reload schema';
