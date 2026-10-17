-- Plano de retenção (2026-10-17). JÁ APLICADO no projeto wjapagkdgjlavonbmjdu; guardado para histórico.
create table if not exists public.eventos_funil (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  evento text not null check (char_length(evento) <= 60),
  sessao text, user_id uuid, caminho text, valor integer,
  utm_source text, utm_campaign text, dispositivo text
);
alter table public.eventos_funil enable row level security;
revoke all on public.eventos_funil from anon, authenticated;
create index if not exists eventos_funil_criado_idx on public.eventos_funil (criado_em desc);
create index if not exists eventos_funil_evento_idx on public.eventos_funil (evento, criado_em desc);
create index if not exists acessos_site_log_criado_idx on public.acessos_site_log (criado_em desc);

alter table public.profiles add column if not exists emails_retencao boolean not null default true;
create table if not exists public.emails_retencao_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, tipo text not null, referencia text not null,
  enviado_em timestamptz not null default now(),
  unique (user_id, tipo, referencia)
);
alter table public.emails_retencao_log enable row level security;
revoke all on public.emails_retencao_log from anon, authenticated;
