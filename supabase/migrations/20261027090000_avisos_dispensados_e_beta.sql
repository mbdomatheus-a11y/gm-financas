-- Avisos dispensáveis guardados na conta (27/10/2026): "não mostrar mais" vale no celular e no computador,
-- até o admin disparar uma rodada nova. rodada_aviso_beta = 0 significa aviso do beta ainda não disparado.
alter table public.configuracoes_acesso_site add column if not exists rodada_aviso_beta int not null default 0;

create table if not exists public.avisos_dispensados (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  aviso text not null check (aviso in ('beta', 'convite')),
  rodada int not null,
  dispensado_em timestamptz not null default now(),
  primary key (user_id, aviso)
);
alter table public.avisos_dispensados enable row level security;
drop policy if exists avisos_dispensados_proprio_ler on public.avisos_dispensados;
drop policy if exists avisos_dispensados_proprio_gravar on public.avisos_dispensados;
drop policy if exists avisos_dispensados_proprio_atualizar on public.avisos_dispensados;
create policy avisos_dispensados_proprio_ler on public.avisos_dispensados for select to authenticated using (user_id = auth.uid());
create policy avisos_dispensados_proprio_gravar on public.avisos_dispensados for insert to authenticated with check (user_id = auth.uid());
create policy avisos_dispensados_proprio_atualizar on public.avisos_dispensados for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
