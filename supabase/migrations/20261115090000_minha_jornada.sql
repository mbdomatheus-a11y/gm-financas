-- Minha jornada (15/11/2026): gamificação leve e opcional. Nada é gravado a cada ação: sequência, nível e
-- conquistas são calculados na hora a partir do que a pessoa já registrou. A única coisa guardada é a
-- escolha de mostrar ou esconder.

create table if not exists public.jornada_usuario (
  user_id uuid primary key references auth.users (id) on delete cascade,
  visivel boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table public.jornada_usuario enable row level security;
-- Sem policy de propósito: leitura e gravação só pelas duas funções abaixo.

create or replace function public.minha_jornada()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  dias jsonb;
begin
  if u is null then raise exception 'Sessão inválida. Entre de novo.'; end if;

  -- Dias (horário de Brasília) em que a pessoa registrou alguma coisa, no último ano.
  select coalesce(jsonb_agg(d order by d desc), '[]'::jsonb) into dias
  from (
    select distinct to_char((x.created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') as d
    from (
      select created_at from despesas where created_by = u and created_at > now() - interval '370 days'
      union all
      select created_at from receitas where created_by = u and created_at > now() - interval '370 days'
      union all
      select created_at from caixinha_aportes where created_by = u and created_at > now() - interval '370 days'
      union all
      select created_at from notas_fiscais where created_by = u and created_at > now() - interval '370 days'
    ) x
  ) t;

  return jsonb_build_object(
    'visivel', coalesce((select j.visivel from jornada_usuario j where j.user_id = u), true),
    'dias', dias,
    'contagens', jsonb_build_object(
      'lancamentos', (select count(*) from despesas where created_by = u) + (select count(*) from receitas where created_by = u),
      'importacoes', (select count(*) from import_lotes where created_by = u),
      'caixinhas', (select count(*) from caixinhas where created_by = u),
      'aportes', (select count(*) from caixinha_aportes where created_by = u),
      'notas', (select count(*) from notas_fiscais where created_by = u),
      'limites', (select count(*) from limites_gasto where user_id = u),
      'investimentos', (select count(*) from investimentos where created_by = u)
    )
  );
end;
$$;
revoke all on function public.minha_jornada() from public, anon;
grant execute on function public.minha_jornada() to authenticated;

create or replace function public.definir_jornada_visivel(p_visivel boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Sessão inválida. Entre de novo.'; end if;
  insert into jornada_usuario (user_id, visivel) values (u, coalesce(p_visivel, true))
  on conflict (user_id) do update set visivel = excluded.visivel, atualizado_em = now();
  return coalesce(p_visivel, true);
end;
$$;
revoke all on function public.definir_jornada_visivel(boolean) from public, anon;
grant execute on function public.definir_jornada_visivel(boolean) to authenticated;
