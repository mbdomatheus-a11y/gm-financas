-- 2026-09-26: integração de armazenamento Oracle Cloud (Object Storage,
-- API S3-compatible) para Notas Fiscais, habilitada por grupo pelo admin
-- do site, com cota fixa de 1 GB por grupo habilitado.
--
-- Prioridade de destino do arquivo (definida com o proprietário):
-- 1. Oracle Object Storage, se o grupo tiver habilitado E ainda tiver cota livre
-- 2. Google Drive do usuário, se conectado (fluxo já existente)
-- 3. Supabase Storage do site (fallback já existente)

-- Habilita/desabilita por grupo, controlado pelo admin do site.
alter table public.grupos
  add column if not exists oracle_storage_habilitado boolean not null default false;

-- Cota fixa por grupo, em bytes. 1 GB = 1073741824 bytes. Deixado como
-- coluna (não constante fixa no código) para o admin poder, no futuro,
-- dar mais cota a um grupo específico sem migração nova.
alter table public.grupos
  add column if not exists oracle_storage_cota_bytes bigint not null default 1073741824;

-- Cada arquivo salvo no Oracle é registrado aqui — soma de bytes_usados
-- por grupo dá o uso atual, comparado contra oracle_storage_cota_bytes
-- antes de cada novo upload.
create table if not exists public.oracle_storage_arquivos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  nota_arquivo_id uuid references public.nota_arquivos(id) on delete cascade,
  object_key text not null,          -- caminho dentro do bucket: "<grupo_id>/<uuid>-<nome>"
  bytes bigint not null,
  mime_type text not null,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);

create index if not exists idx_oracle_storage_arquivos_grupo
  on public.oracle_storage_arquivos (grupo_id);

alter table public.oracle_storage_arquivos enable row level security;

-- Leitura: só membros do próprio grupo veem os registros do grupo.
create policy "oracle_storage_arquivos_select_proprio_grupo"
  on public.oracle_storage_arquivos for select
  using (
    grupo_id in (select grupo_id from public.profiles where id = auth.uid())
  );

-- Escrita: só via service role (server functions), nunca direto do
-- cliente — mesma lógica de nota_arquivos hoje.
create policy "oracle_storage_arquivos_service_role_all"
  on public.oracle_storage_arquivos for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.oracle_storage_arquivos is
  'Registro de cada arquivo salvo no Oracle Object Storage, para somar uso contra a cota do grupo (oracle_storage_cota_bytes em grupos). Bucket físico e credenciais ficam em variáveis de ambiente, nunca nesta tabela.';
