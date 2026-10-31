-- Pesquisa "Está gostando?" (joinha) no fim das telas do site e do app (31/10/2026).
-- Uma opinião por pessoa, tela, plataforma e versão: dá para comparar versões (benchmark).
create table if not exists public.avaliacoes_tela (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plataforma text not null check (plataforma in ('ios','android','web')),
  tela text not null check (char_length(tela) between 1 and 120),
  voto smallint not null check (voto in (-1, 1)),
  comentario text check (comentario is null or char_length(comentario) <= 500),
  versao text not null default '' check (char_length(versao) <= 40),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, plataforma, tela, versao)
);
create index if not exists avaliacoes_tela_tela_idx on public.avaliacoes_tela (tela, plataforma, criado_em desc);
alter table public.avaliacoes_tela enable row level security;
drop policy if exists "avaliacoes_tela_ler_propria" on public.avaliacoes_tela;
create policy "avaliacoes_tela_ler_propria" on public.avaliacoes_tela for select to authenticated using (user_id = auth.uid());
drop policy if exists "avaliacoes_tela_inserir_propria" on public.avaliacoes_tela;
create policy "avaliacoes_tela_inserir_propria" on public.avaliacoes_tela for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "avaliacoes_tela_editar_propria" on public.avaliacoes_tela;
create policy "avaliacoes_tela_editar_propria" on public.avaliacoes_tela for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.avaliacoes_tela from anon;
grant select, insert, update on public.avaliacoes_tela to authenticated;
