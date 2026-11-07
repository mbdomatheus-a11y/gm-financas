-- Preferências de notificação por usuário (07/11/2026).
-- Uma linha por usuário. Sem linha = tudo ligado (o app usa os mesmos padrões abaixo).
-- Rodar com backup. Não altera nenhuma tabela existente.
create table if not exists public.preferencias_notificacao (
  user_id uuid primary key references auth.users(id) on delete cascade,
  receber_todas boolean not null default true,
  canal_push boolean not null default true,
  canal_email boolean not null default true,
  silencio_ativo boolean not null default false,
  silencio_inicio time not null default '22:00',
  silencio_fim time not null default '08:00',
  -- Chaves (todas boolean, padrão true quando ausentes):
  -- despesa_perto_vencer, revisar_faturas, receita_a_receber, limite_perto,
  -- meta_sem_aporte, revisar_transacoes, dicas_economia
  lembretes jsonb not null default '{}'::jsonb check (jsonb_typeof(lembretes) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.preferencias_notificacao enable row level security;

drop policy if exists "pref_notif_ler_proprio" on public.preferencias_notificacao;
create policy "pref_notif_ler_proprio" on public.preferencias_notificacao
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "pref_notif_inserir_proprio" on public.preferencias_notificacao;
create policy "pref_notif_inserir_proprio" on public.preferencias_notificacao
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "pref_notif_atualizar_proprio" on public.preferencias_notificacao;
create policy "pref_notif_atualizar_proprio" on public.preferencias_notificacao
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "pref_notif_excluir_proprio" on public.preferencias_notificacao;
create policy "pref_notif_excluir_proprio" on public.preferencias_notificacao
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.preferencias_notificacao from anon;
grant select, insert, update, delete on public.preferencias_notificacao to authenticated;

create or replace function public.preferencias_notificacao_tocar_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_preferencias_notificacao_updated_at on public.preferencias_notificacao;
create trigger trg_preferencias_notificacao_updated_at
  before update on public.preferencias_notificacao
  for each row execute function public.preferencias_notificacao_tocar_updated_at();
