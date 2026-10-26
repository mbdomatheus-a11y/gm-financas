-- Faturas que batem com o banco (26/10/2026). Plano: claude/plano-faturas-conciliacao-2026-10-25.md

-- 1) A trava de lançamentos do banco aceita a conciliação com a fatura do próprio banco
--    (a função de conciliação liga app.conciliacao só dentro da sua transação).
create or replace function public.congelar_parcela_pluggy() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare d record;
begin
  if coalesce(current_setting('app.conciliacao', true), '') = 'on' then
    if TG_OP = 'DELETE' then return OLD; end if; return NEW;
  end if;
  select origem, congelada, importada_em into d from public.despesas where id = OLD.despesa_id;
  if d.origem = 'pluggy' and (d.congelada or (d.importada_em is not null and d.importada_em < now() - interval '30 days')) then
    raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end; $$;

create or replace function public.congelar_despesa_pluggy() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(current_setting('app.conciliacao', true), '') = 'on' then
    if TG_OP = 'DELETE' then return OLD; end if; return NEW;
  end if;
  if OLD.origem = 'pluggy' and (OLD.congelada or (OLD.importada_em is not null and OLD.importada_em < now() - interval '30 days')) then
    raise exception 'Lançamento importado pelo banco e congelado. Não pode ser alterado nem excluído.' using errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end; $$;

-- 2) Dados crus que a Pluggy manda de cada compra (billId, purchaseDate, parcela, moeda).
alter table public.pluggy_transacoes add column if not exists meta jsonb;

-- 3) Fatura real de cada cartão por mês: vencimento, fechamento e total do banco.
create table if not exists public.cartao_faturas_banco (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  cartao_id uuid not null references public.cartoes(id) on delete cascade,
  vencimento date not null,
  fechamento date,
  total_banco numeric(12,2),
  total_sistema numeric(12,2),
  origem text not null default 'pdf',
  import_fatura_id uuid,
  conciliada_em timestamptz,
  resumo jsonb,
  atualizado_em timestamptz not null default now(),
  unique (cartao_id, vencimento)
);
alter table public.cartao_faturas_banco enable row level security;
drop policy if exists cartao_faturas_banco_grupo on public.cartao_faturas_banco;
create policy cartao_faturas_banco_grupo on public.cartao_faturas_banco
  for all to authenticated
  using (grupo_id = private.meu_grupo_id())
  with check (grupo_id = private.meu_grupo_id());

-- 4) Concilia uma fatura importada do PDF com os lançamentos do Open Finance do mesmo cartão.
--  * Cada linha do PDF acha a linha do banco (mesmo valor; mesma parcela n/t quando parcelada;
--    nome parecido ou data próxima). A compra do banco passa a vencer nesta fatura (e as outras
--    parcelas acompanham, uma por mês) e a cópia do PDF é apagada.
--  * Linha do PDF sem par no Open Finance (IOF, ajuste, compra que a Pluggy não mandou) fica.
--  * Lançamento do Open Finance que o sistema punha nesta fatura e o banco não cobrou vai para
--    a lista "nao_cobrados" (a pessoa decide mover ou excluir).
create or replace function public.conciliar_fatura_pdf(p_fatura uuid, p_cartao uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  g uuid := private.meu_grupo_id();
  f record;
  c record;
  linha record;
  par record;
  casados int := 0;
  mantidos int := 0;
  usados uuid[] := '{}';
  nao_cobrados jsonb := '[]'::jsonb;
  total_sis numeric;
begin
  if g is null then raise exception 'Grupo não encontrado.'; end if;
  select * into f from public.import_faturas where id = p_fatura and grupo_id = g;
  if not found then raise exception 'Fatura importada não encontrada.'; end if;
  if f.vencimento is null then raise exception 'A fatura importada não tem vencimento.'; end if;
  select * into c from public.cartoes where id = p_cartao and grupo_id = g;
  if not found then raise exception 'Cartão não encontrado.'; end if;
  perform set_config('app.conciliacao', 'on', true);

  for linha in
    select p.id parcela_id, p.valor, p.numero, d.id despesa_id, d.descricao, d.total_parcelas, d.data_compra
    from public.parcelas p join public.despesas d on d.id = p.despesa_id
    where d.fatura_id = p_fatura and d.grupo_id = g and coalesce(d.origem, '') <> 'pluggy'
      and coalesce(d.direcao, 'saida') <> 'entrada'
  loop
    par := null;
    select pp.id parcela_id, pp.numero, pp.vencimento, dp.id despesa_id into par
    from public.parcelas pp join public.despesas dp on dp.id = pp.despesa_id
    where dp.grupo_id = g and dp.origem = 'pluggy'
      and (dp.cartao_id = p_cartao or dp.cartao_final = c.final)
      and not (pp.id = any(usados))
      and abs(pp.valor - linha.valor) < 0.005
      and pp.vencimento between f.vencimento - 75 and f.vencimento + 75
      and (case when coalesce(linha.total_parcelas, 1) > 1
                then dp.total_parcelas = linha.total_parcelas and pp.numero = linha.numero
                else coalesce(dp.total_parcelas, 1) = 1 end)
      and (split_part(trim(regexp_replace(upper(public.unaccent_safe(dp.descricao)), '[^A-Z0-9 ]', ' ', 'g')), ' ', 1)
             = split_part(trim(regexp_replace(upper(public.unaccent_safe(linha.descricao)), '[^A-Z0-9 ]', ' ', 'g')), ' ', 1)
           or abs(dp.data_compra - linha.data_compra) <= 5)
    order by (pp.vencimento = f.vencimento) desc, abs(dp.data_compra - linha.data_compra), abs(pp.vencimento - f.vencimento)
    limit 1;

    if par.parcela_id is null then
      update public.despesas set cartao_id = p_cartao, cartao_final = coalesce(cartao_final, c.final) where id = linha.despesa_id;
      mantidos := mantidos + 1;
      continue;
    end if;
    usados := usados || par.parcela_id;
    casados := casados + 1;
    -- a compra do banco vence nesta fatura; as demais parcelas acompanham, uma por mês
    if par.vencimento <> f.vencimento then
      update public.parcelas set vencimento = (f.vencimento + make_interval(months => numero - par.numero))::date
      where despesa_id = par.despesa_id;
    end if;
    update public.parcelas set fatura_id = p_fatura where id = par.parcela_id;
    update public.despesas set fatura_id = coalesce(fatura_id, p_fatura) where id = par.despesa_id;
    -- a cópia que veio do PDF sai (o lançamento do banco já representa a compra)
    delete from public.parcelas where despesa_id = linha.despesa_id;
    delete from public.despesas where id = linha.despesa_id;
  end loop;

  -- o que o sistema punha nesta fatura e o banco não cobrou
  select coalesce(jsonb_agg(jsonb_build_object('despesa_id', d.id, 'parcela_id', p.id, 'descricao', d.descricao,
           'valor', p.valor, 'parcela', p.numero || '/' || p.total, 'data_compra', d.data_compra)), '[]'::jsonb)
    into nao_cobrados
  from public.parcelas p join public.despesas d on d.id = p.despesa_id
  where d.grupo_id = g and d.origem = 'pluggy' and (d.cartao_id = p_cartao or d.cartao_final = c.final)
    and p.vencimento = f.vencimento and not (p.id = any(usados));

  select coalesce(sum(p.valor), 0) into total_sis
  from public.parcelas p join public.despesas d on d.id = p.despesa_id
  where d.grupo_id = g and (d.cartao_id = p_cartao or d.cartao_final = c.final or d.fatura_id = p_fatura)
    and p.vencimento = f.vencimento and coalesce(d.direcao, 'saida') <> 'entrada';

  insert into public.cartao_faturas_banco (grupo_id, cartao_id, vencimento, total_banco, total_sistema, origem, import_fatura_id, conciliada_em, resumo, atualizado_em)
  values (g, p_cartao, f.vencimento, f.total_declarado, total_sis, 'pdf', p_fatura, now(),
          jsonb_build_object('casados', casados, 'mantidos_do_pdf', mantidos, 'nao_cobrados', nao_cobrados), now())
  on conflict (cartao_id, vencimento) do update set total_banco = excluded.total_banco, total_sistema = excluded.total_sistema,
    origem = 'pdf', import_fatura_id = excluded.import_fatura_id, conciliada_em = now(), resumo = excluded.resumo, atualizado_em = now();

  update public.import_faturas set cartao_id = coalesce(cartao_id, p_cartao) where id = p_fatura;

  return jsonb_build_object('vencimento', f.vencimento, 'total_banco', f.total_declarado, 'total_sistema', total_sis,
    'diferenca', round(total_sis - coalesce(f.total_declarado, 0), 2), 'casados', casados, 'mantidos_do_pdf', mantidos,
    'nao_cobrados', nao_cobrados);
end; $$;

-- Lançamento do banco que a fatura real não tem: mover para a próxima fatura ou excluir.
create or replace function public.ajustar_lancamento_conciliacao(p_despesa uuid, p_acao text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare g uuid := private.meu_grupo_id();
begin
  if g is null or not exists (select 1 from public.despesas where id = p_despesa and grupo_id = g) then
    raise exception 'Lançamento não encontrado.';
  end if;
  perform set_config('app.conciliacao', 'on', true);
  if p_acao = 'excluir' then
    delete from public.parcelas where despesa_id = p_despesa;
    delete from public.despesas where id = p_despesa;
  elsif p_acao = 'proxima' then
    update public.parcelas set vencimento = (vencimento + interval '1 month')::date where despesa_id = p_despesa;
  else
    raise exception 'Ação inválida.';
  end if;
end; $$;

-- remove acentos sem depender da extensão unaccent
create or replace function public.unaccent_safe(t text) returns text language sql immutable as $$
  select translate(coalesce(t, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

revoke all on function public.conciliar_fatura_pdf(uuid, uuid) from public, anon;
revoke all on function public.ajustar_lancamento_conciliacao(uuid, text) from public, anon;
grant execute on function public.conciliar_fatura_pdf(uuid, uuid) to authenticated;
grant execute on function public.ajustar_lancamento_conciliacao(uuid, text) to authenticated;
