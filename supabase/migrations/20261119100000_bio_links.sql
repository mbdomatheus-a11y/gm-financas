-- 19/11/2026: página de links ("link na bio") no domínio do Control ALL, só por link direto (/bio/<nome>).
-- Não aparece no site nem no app; só o admin do site gerencia. Sem policies: só o servidor lê e grava.
create table if not exists public.bio_paginas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  titulo text not null default '',
  bio text not null default '',
  foto_path text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table if not exists public.bio_links (
  id uuid primary key default gen_random_uuid(),
  pagina_id uuid not null references public.bio_paginas(id) on delete cascade,
  titulo text not null check (length(titulo) between 1 and 80),
  url text not null check (url ~ '^https?://'),
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
-- Visitas e cliques com os mesmos dados do registro de acessos do site (acessos_site_log).
-- Origem, local, IP e navegador só com o aceite de cookies de métricas (mesma regra do site).
create table if not exists public.bio_eventos (
  id bigserial primary key,
  pagina_id uuid not null references public.bio_paginas(id) on delete cascade,
  link_id uuid references public.bio_links(id) on delete set null,
  tipo text not null check (tipo in ('visita', 'clique')),
  metricas boolean not null default false,
  referrer text, utm_source text, utm_medium text, utm_campaign text,
  ip text, cidade text, regiao text, pais text, user_agent text,
  dispositivo text, sessao text,
  criado_em timestamptz not null default now()
);
create index if not exists bio_eventos_pagina_data on public.bio_eventos (pagina_id, criado_em desc);
create index if not exists bio_links_pagina on public.bio_links (pagina_id, ordem);
alter table public.bio_paginas enable row level security;
alter table public.bio_links enable row level security;
alter table public.bio_eventos enable row level security;
