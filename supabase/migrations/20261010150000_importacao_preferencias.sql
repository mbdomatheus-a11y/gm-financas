-- Lembra a escolha feita na importação para o mesmo estabelecimento (ex.: "esta
-- linha substitui o valor daquela despesa fixa"), para repetir na próxima fatura.
create table if not exists public.importacao_preferencias (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  chave text not null,
  escopo text not null default 'fixa',
  acao text not null,
  despesa_id uuid references public.despesas(id) on delete cascade,
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  unique (grupo_id, chave, escopo)
);
alter table public.importacao_preferencias enable row level security;
create policy importacao_preferencias_do_grupo on public.importacao_preferencias
  for all using (grupo_id = private.meu_grupo_id()) with check (grupo_id = private.meu_grupo_id());
