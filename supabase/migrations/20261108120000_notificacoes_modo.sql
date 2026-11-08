-- Notificações na hora do evento (08/11/2026). Idempotente: pode rodar mais de uma vez.
-- 1. Preferência de horário: sempre (padrão), janela (só entre início e fim) ou desligado.
-- 2. Caixa de avisos (notificacoes_usuario): arquivar, destino, chave anti-duplicidade e estado do push.
-- 3. Gatilhos: todo aviso gravado dispara o envio do push na hora (pg_net chama /api/push/despachar).
--    Lançamento novo (parcelas) pede a conferência dos limites; convite de grupo vira aviso.
-- 4. pg_cron de hora em hora chama /api/cron/alertas (vencimentos, faturas, garantias e entregas agendadas).
-- Depois de rodar: preencher private.push_config (ver o fim do arquivo).

-- ---------- 1. Preferência de horário ----------
alter table public.preferencias_notificacao add column if not exists modo_horario text not null default 'sempre';
alter table public.preferencias_notificacao add column if not exists janela_inicio time not null default '08:00';
alter table public.preferencias_notificacao add column if not exists janela_fim time not null default '22:00';
alter table public.preferencias_notificacao drop constraint if exists preferencias_notificacao_modo_horario_chk;
alter table public.preferencias_notificacao add constraint preferencias_notificacao_modo_horario_chk
  check (modo_horario in ('sempre', 'janela', 'desligado'));

-- Quem usava "Não perturbe" (22:00 a 08:00) passa a "Só entre 08:00 e 22:00".
update public.preferencias_notificacao
   set modo_horario = 'janela', janela_inicio = silencio_fim, janela_fim = silencio_inicio, silencio_ativo = false
 where silencio_ativo and modo_horario = 'sempre';

-- ---------- 2. Caixa de avisos ----------
alter table public.notificacoes_usuario add column if not exists arquivada_em timestamptz null;
alter table public.notificacoes_usuario add column if not exists destino text null;
alter table public.notificacoes_usuario add column if not exists chave text null;
alter table public.notificacoes_usuario add column if not exists lembrete text null;
-- Linhas antigas ficam 'ignorado' (não disparam push); as novas nascem 'pendente'.
alter table public.notificacoes_usuario add column if not exists push_status text not null default 'ignorado';
alter table public.notificacoes_usuario alter column push_status set default 'pendente';
alter table public.notificacoes_usuario add column if not exists push_agendado_para timestamptz null;
alter table public.notificacoes_usuario add column if not exists push_enviado_em timestamptz null;
alter table public.notificacoes_usuario drop constraint if exists notificacoes_usuario_push_status_chk;
alter table public.notificacoes_usuario add constraint notificacoes_usuario_push_status_chk
  check (push_status in ('pendente', 'processando', 'agendado', 'enviado', 'ignorado'));

create unique index if not exists notificacoes_usuario_user_chave_uidx on public.notificacoes_usuario (user_id, chave);
create index if not exists notificacoes_usuario_push_fila_idx on public.notificacoes_usuario (push_status, push_agendado_para)
  where push_status in ('pendente', 'agendado');
create index if not exists notificacoes_usuario_user_criado_idx on public.notificacoes_usuario (user_id, criado_em desc);

-- O usuário marca como lida, arquiva e exclui os próprios avisos; o estado do push é só do servidor.
revoke update on public.notificacoes_usuario from authenticated;
grant update (lida_em, arquivada_em) on public.notificacoes_usuario to authenticated;
grant select, delete on public.notificacoes_usuario to authenticated;

-- ---------- 3. Chamada ao servidor (pg_net) ----------
create schema if not exists private;
do $$ begin
  create extension if not exists pg_net;
exception when others then raise notice 'pg_net indisponível: o push sai pelo cron (%).', sqlerrm;
end $$;

create table if not exists private.push_config (
  id int primary key default 1 check (id = 1),
  url_base text not null,      -- ex.: https://controlall.com.br (sem barra no fim)
  segredo text not null        -- mesmo valor do CRON_SECRET da Vercel
);
alter table private.push_config enable row level security;
revoke all on private.push_config from public, anon, authenticated;

create or replace function private.chamar_servidor(caminho text, corpo jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cfg record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  select url_base, segredo into cfg from private.push_config where id = 1;
  if cfg.url_base is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
    using rtrim(cfg.url_base, '/') || caminho, coalesce(corpo, '{}'::jsonb),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || cfg.segredo);
exception when others then
  raise warning 'chamar_servidor % falhou: %', caminho, sqlerrm; -- nunca quebra a gravação
end $$;
revoke all on function private.chamar_servidor(text, jsonb) from public, anon, authenticated;

-- Todo aviso novo: push na hora (o servidor aplica as preferências e a janela de horário).
create or replace function private.notificacoes_usuario_disparar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
begin
  select array_agg(n.id) into ids from novas n where n.push_status = 'pendente';
  if ids is not null then
    perform private.chamar_servidor('/api/push/despachar', jsonb_build_object('ids', to_jsonb(ids)));
  end if;
  return null;
end $$;

drop trigger if exists trg_notificacoes_usuario_disparar on public.notificacoes_usuario;
create trigger trg_notificacoes_usuario_disparar after insert on public.notificacoes_usuario
  referencing new table as novas for each statement execute function private.notificacoes_usuario_disparar();

-- Lançamento novo: o servidor confere os limites de gastos do grupo (aviso de limite perto/estourado).
create or replace function private.parcelas_conferir_limites()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  grupos uuid[];
begin
  if not exists (select 1 from public.limites_gasto l where l.ativo) then return null; end if;
  select array_agg(distinct n.grupo_id) into grupos from novas n where n.grupo_id is not null;
  if grupos is not null then
    perform private.chamar_servidor('/api/push/despachar', jsonb_build_object('grupos', to_jsonb(grupos)));
  end if;
  return null;
end $$;

drop trigger if exists trg_parcelas_conferir_limites on public.parcelas;
create trigger trg_parcelas_conferir_limites after insert on public.parcelas
  referencing new table as novas for each statement execute function private.parcelas_conferir_limites();

-- Convite de grupo para quem já tem conta: aviso (e push) na hora.
create or replace function private.convites_grupo_avisar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  destino_id uuid;
  quem text;
begin
  select p.id into destino_id from public.profiles p
   where lower(p.email) = lower(new.email_destino) and p.ativo limit 1;
  if destino_id is null or destino_id = new.criado_por then return new; end if;
  select coalesce(nullif(trim(p.nome), ''), 'Alguém') into quem from public.profiles p where p.id = new.criado_por;
  insert into public.notificacoes_usuario (user_id, tipo, titulo, mensagem, referencia_tipo, referencia_id, destino, chave)
  values (destino_id, 'convite', 'Convite para um grupo', coalesce(quem, 'Alguém') || ' convidou você para dividir as finanças.',
          'convites_grupo', new.id, '/mais/convites', 'convite:' || new.id)
  on conflict (user_id, chave) do nothing;
  return new;
exception when others then
  raise warning 'convites_grupo_avisar: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_convites_grupo_avisar on public.convites_grupo;
create trigger trg_convites_grupo_avisar after insert on public.convites_grupo
  for each row execute function private.convites_grupo_avisar();

-- Aviso da regra do ciclo (20261108100000) ganha destino; o gatilho acima já manda o push.
create or replace function private.regra_ciclo_grupo_avisar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dia_virada is distinct from old.dia_virada then
    insert into public.notificacoes_usuario (user_id, tipo, titulo, mensagem, referencia_tipo, referencia_id, destino)
    select p.id, 'regra_ciclo', 'Ciclo do mês alterado',
           coalesce(new.atualizado_por_nome, 'Alguém do grupo') || ' mudou a virada para o dia ' || new.dia_virada || '.',
           'regra_ciclo_grupo', new.grupo_id, '/mais/configuracoes'
      from public.profiles p
     where p.grupo_id = new.grupo_id and p.id is distinct from auth.uid();
  end if;
  return new;
end $$;

-- ---------- 4. Verificação de hora em hora (pg_cron) ----------
-- Vercel Hobby só aceita cron diário: o vercel.json tem a rede de segurança diária e o pg_cron faz a hora em hora.
do $$ begin
  create extension if not exists pg_cron;
exception when others then raise notice 'pg_cron indisponível: fica só o cron diário da Vercel (%).', sqlerrm;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'controlall-alertas-hora';
    perform cron.schedule('controlall-alertas-hora', '2 * * * *',
      $job$select private.chamar_servidor('/api/cron/alertas', '{}'::jsonb)$job$);
  end if;
exception when others then raise notice 'Agendamento do pg_cron não criado: %', sqlerrm;
end $$;

-- Depois de rodar, uma vez (troque os valores):
-- insert into private.push_config (id, url_base, segredo) values (1, 'https://SEU-DOMINIO', 'VALOR_DO_CRON_SECRET')
--   on conflict (id) do update set url_base = excluded.url_base, segredo = excluded.segredo;
