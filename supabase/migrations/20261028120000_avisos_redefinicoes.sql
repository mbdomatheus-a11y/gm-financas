-- Admin redefine os avisos já vistos/dispensados de um usuário ou de todos (28/10/2026).
-- Cada linha é um pedido; o site e o app comparam a data com a última que aplicaram e limpam o que
-- fica guardado no aparelho (cookies, convite, primeiros passos, tour do app etc.).
create table if not exists public.avisos_redefinicoes (
  id bigint generated always as identity primary key,
  alvo_user_id uuid references auth.users(id) on delete cascade, -- null = todos os usuários
  criado_em timestamptz not null default now(),
  criado_por uuid
);
create index if not exists avisos_redefinicoes_alvo_idx on public.avisos_redefinicoes (alvo_user_id, criado_em desc);
alter table public.avisos_redefinicoes enable row level security;
drop policy if exists "ver redefinicoes de avisos para mim" on public.avisos_redefinicoes;
create policy "ver redefinicoes de avisos para mim" on public.avisos_redefinicoes
  for select to authenticated using (alvo_user_id is null or alvo_user_id = auth.uid());
revoke insert, update, delete on public.avisos_redefinicoes from anon, authenticated;
