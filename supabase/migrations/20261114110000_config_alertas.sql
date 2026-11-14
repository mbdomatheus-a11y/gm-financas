-- Painel de alertas do sistema (14/11/2026). Idempotente: pode rodar mais de uma vez.
-- 1. public.config_alertas: um registro por tipo de alerta (liga/desliga, frequência, dia/hora, antecedência, canais).
-- 2. notificacoes_usuario.alerta: tipo de alerta da configuração (calculado no gatilho quando vier vazio).
-- 3. Gatilho antes de gravar o aviso: tipo desligado não grava; sem canal push não manda push; sem canal app
--    vai direto para arquivados; frequência diferente de na_hora fica em 'lote' (o cron de hora em hora manda o resumo).
-- O seed repete o que o código fazia até aqui (nada muda até o admin alterar). Ver docs/alertas.md.

-- ---------- 1. Configuração ----------
create table if not exists public.config_alertas (
  tipo text primary key,
  ativo boolean not null default true,
  frequencia text not null default 'na_hora',
  dia_semana int null,
  dia_mes int null,
  hora int null default 9,
  antecedencia_dias int null,
  canais text[] not null default '{push,app}',
  titulo_modelo text null,
  atualizado_por uuid null references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
alter table public.config_alertas drop constraint if exists config_alertas_frequencia_chk;
alter table public.config_alertas add constraint config_alertas_frequencia_chk
  check (frequencia in ('na_hora', 'diaria', 'semanal', 'quinzenal', 'mensal'));
alter table public.config_alertas drop constraint if exists config_alertas_valores_chk;
alter table public.config_alertas add constraint config_alertas_valores_chk check (
  (dia_semana is null or dia_semana between 0 and 6)
  and (dia_mes is null or dia_mes between 1 and 31)
  and (hora is null or hora between 0 and 23)
  and (antecedencia_dias is null or antecedencia_dias between 0 and 90)
  and canais <@ array['push', 'app', 'email']::text[]
);

alter table public.config_alertas enable row level security;
drop policy if exists config_alertas_select on public.config_alertas;
create policy config_alertas_select on public.config_alertas for select to authenticated using (true);
drop policy if exists config_alertas_insert on public.config_alertas;
create policy config_alertas_insert on public.config_alertas for insert to authenticated
  with check (private.is_admin(auth.uid()));
drop policy if exists config_alertas_update on public.config_alertas;
create policy config_alertas_update on public.config_alertas for update to authenticated
  using (private.is_admin(auth.uid())) with check (private.is_admin(auth.uid()));
revoke all on public.config_alertas from anon;
grant select, insert, update on public.config_alertas to authenticated;
grant all on public.config_alertas to service_role;

-- Quem alterou e quando (também para edição direta pelo painel do Supabase).
create or replace function private.config_alertas_carimbo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  return new;
end $$;
drop trigger if exists trg_config_alertas_carimbo on public.config_alertas;
create trigger trg_config_alertas_carimbo before insert or update on public.config_alertas
  for each row execute function private.config_alertas_carimbo();

-- Padrões atuais (on conflict do nothing: não sobrescreve o que o admin já mudou).
insert into public.config_alertas (tipo, ativo, frequencia, dia_semana, dia_mes, hora, antecedencia_dias, canais, titulo_modelo) values
  ('parcela_vence',      true,  'na_hora', null, null, 7,    1,    '{push,app}', null),
  ('fatura_fecha',       true,  'na_hora', null, null, 7,    0,    '{push,app}', null),
  ('fatura_vence',       true,  'na_hora', null, null, 7,    1,    '{push,app}', null),
  ('garantia_acabando',  true,  'na_hora', null, null, 7,    30,   '{push,app}', null),
  ('parcelas_terminam',  false, 'semanal', 1,    null, 9,    7,    '{push,app}', '{n} parcelas terminam nesta semana'),
  ('limite',             true,  'na_hora', null, null, null, null, '{push,app}', null),
  ('open_finance',       true,  'na_hora', null, null, null, null, '{push,app}', null),
  ('convite',            true,  'na_hora', null, null, null, null, '{push,app}', null),
  ('regra_ciclo',        true,  'na_hora', null, null, null, null, '{push,app}', null),
  ('layout_pendente',    true,  'na_hora', null, null, null, null, '{push,app}', null),
  ('layout_corrigido',   true,  'na_hora', null, null, null, null, '{push,app}', null),
  ('vencimento_email',   true,  'diaria',  null, null, null, 3,    '{email}',    null),
  ('resumo_semanal_email', true, 'semanal', 1,   null, null, null, '{email}',    null),
  ('ativacao_email',     true,  'diaria',  null, null, null, null, '{email}',    null)
on conflict (tipo) do nothing;

-- ---------- 2. Caixa de avisos ----------
alter table public.notificacoes_usuario add column if not exists alerta text null;
alter table public.notificacoes_usuario drop constraint if exists notificacoes_usuario_push_status_chk;
alter table public.notificacoes_usuario add constraint notificacoes_usuario_push_status_chk
  check (push_status in ('pendente', 'processando', 'agendado', 'enviado', 'ignorado', 'lote'));
create index if not exists notificacoes_usuario_lote_idx on public.notificacoes_usuario (alerta)
  where push_status = 'lote';

-- ---------- 3. Gatilho: aplica a configuração ao gravar ----------
create or replace function private.notificacoes_usuario_aplicar_config()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cfg record;
begin
  if new.alerta is null then
    new.alerta := case new.tipo
      when 'parcela' then 'parcela_vence'
      when 'parcela_fim' then 'parcelas_terminam'
      when 'garantia' then 'garantia_acabando'
      when 'fatura' then case when coalesce(new.chave, '') like 'fatura:%:fecha:%' then 'fatura_fecha' else 'fatura_vence' end
      else new.tipo end;
  end if;
  select c.ativo, c.frequencia, c.canais into cfg from public.config_alertas c where c.tipo = new.alerta;
  if not found then return new; end if;
  if not cfg.ativo then return null; end if; -- tipo desligado: não gera aviso
  if new.push_status = 'pendente' then
    if not ('push' = any (cfg.canais)) then new.push_status := 'ignorado';
    elsif cfg.frequencia <> 'na_hora' then new.push_status := 'lote';
    end if;
  end if;
  if not ('app' = any (cfg.canais)) then new.arquivada_em := coalesce(new.arquivada_em, now()); end if;
  return new;
exception when others then
  raise warning 'notificacoes_usuario_aplicar_config: %', sqlerrm;
  return new; -- nunca quebra a gravação
end $$;
revoke all on function private.notificacoes_usuario_aplicar_config() from public, anon, authenticated;

drop trigger if exists trg_notificacoes_usuario_config on public.notificacoes_usuario;
create trigger trg_notificacoes_usuario_config before insert on public.notificacoes_usuario
  for each row execute function private.notificacoes_usuario_aplicar_config();
