-- Foto do usuário (bucket público "avatares", 2 MB, só imagem).
alter table public.profiles add column if not exists foto_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy avatares_leitura_publica on storage.objects for select using (bucket_id = 'avatares');
create policy avatares_dono_insere on storage.objects for insert
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatares_dono_atualiza on storage.objects for update
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatares_dono_apaga on storage.objects for delete
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- Link aberto da anotação: funciona sem conta enquanto estiver ligado.
alter table public.links_admin add column if not exists publico boolean not null default false;
alter table public.links_admin add column if not exists token_publico text unique;
