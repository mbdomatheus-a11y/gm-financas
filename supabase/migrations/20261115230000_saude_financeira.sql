-- Saúde financeira (15/11/2026): nota de 0 a 100 calculada no aparelho (lib/saude-financeira.ts, igual no
-- site e no app). O banco só entrega os números que o aparelho não tem à mão e guarda a MELHOR nota, para
-- as conquistas "Saúde boa" e "Saúde ótima" da Minha jornada nunca se perderem.

create table if not exists public.saude_melhor (
  user_id uuid primary key references auth.users (id) on delete cascade,
  melhor integer not null default 0 check (melhor between 0 and 100),
  atualizado_em timestamptz not null default now()
);
alter table public.saude_melhor enable row level security;
-- Sem policy de propósito: só pelas funções abaixo.

-- Melhor nota de cada ciclo: dá EXP por faixa alcançada (uma vez por ciclo) e a conquista "Três ciclos no verde".
create table if not exists public.saude_ciclos (
  user_id uuid not null references auth.users (id) on delete cascade,
  ciclo text not null check (ciclo ~ '^\d{4}-\d{2}$'),
  melhor integer not null default 0 check (melhor between 0 and 100),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, ciclo)
);
alter table public.saude_ciclos enable row level security;

create or replace function public.meus_dados_saude(p_inicio date, p_hoje date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  g uuid := private.meu_grupo_id();
begin
  if u is null or g is null then raise exception 'Sessão inválida. Entre de novo.'; end if;
  return jsonb_build_object(
    'guardado', coalesce((select sum(a.valor) from caixinha_aportes a where a.grupo_id = g), 0),
    'contasVencidas', (select count(*) from parcelas p join despesas d on d.id = p.despesa_id
                       where p.grupo_id = g and d.cartao_id is null and p.vencimento between p_inicio and p_hoje),
    'contasPagas', (select count(*) from parcelas p join despesas d on d.id = p.despesa_id
                    where p.grupo_id = g and d.cartao_id is null and p.vencimento between p_inicio and p_hoje and p.paga),
    'cartaoEmAberto', coalesce((select sum(p.valor) from parcelas p join despesas d on d.id = p.despesa_id
                                where p.grupo_id = g and d.cartao_id is not null and not p.paga and p.vencimento >= p_hoje), 0),
    'cartaoLimite', coalesce((select sum(c.limite) from cartoes c where c.grupo_id = g and coalesce(c.limite, 0) > 0), 0),
    'diasComRegistro14', (select count(distinct (x.created_at at time zone 'America/Sao_Paulo')::date) from (
        select created_at from despesas where created_by = u and created_at > now() - interval '14 days'
        union all select created_at from receitas where created_by = u and created_at > now() - interval '14 days'
        union all select created_at from caixinha_aportes where created_by = u and created_at > now() - interval '14 days'
      ) x)
  );
end;
$$;
revoke all on function public.meus_dados_saude(date, date) from public, anon;
grant execute on function public.meus_dados_saude(date, date) to authenticated;

create or replace function public.registrar_saude(p_nota integer, p_ciclo text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  n integer := greatest(0, least(100, coalesce(p_nota, 0)));
  r integer;
begin
  if u is null then raise exception 'Sessão inválida. Entre de novo.'; end if;
  insert into saude_melhor (user_id, melhor) values (u, n)
  on conflict (user_id) do update set melhor = greatest(saude_melhor.melhor, excluded.melhor), atualizado_em = now()
  returning melhor into r;
  if p_ciclo ~ '^\d{4}-\d{2}$' then
    insert into saude_ciclos (user_id, ciclo, melhor) values (u, p_ciclo, n)
    on conflict (user_id, ciclo) do update set melhor = greatest(saude_ciclos.melhor, excluded.melhor), atualizado_em = now();
  end if;
  return r;
end;
$$;
revoke all on function public.registrar_saude(integer, text) from public, anon;
grant execute on function public.registrar_saude(integer, text) to authenticated;

-- Minha jornada passa a devolver a melhor nota de saúde (conquistas Saúde boa e Saúde ótima).
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
      'investimentos', (select count(*) from investimentos where created_by = u),
      'melhorSaude', coalesce((select s.melhor from saude_melhor s where s.user_id = u), 0),
      'ciclosBons', (select count(*) from saude_ciclos c where c.user_id = u and c.melhor >= 60),
      'faixasSaude', coalesce((select sum(case when c.melhor >= 80 then 3 when c.melhor >= 60 then 2 when c.melhor >= 40 then 1 else 0 end) from saude_ciclos c where c.user_id = u), 0)
    )
  );
end;
$$;
