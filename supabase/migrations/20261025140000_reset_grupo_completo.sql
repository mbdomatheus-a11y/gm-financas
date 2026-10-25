-- Reset completo do grupo do administrador, com backup automático e trava de lançamento importado
-- desligada só durante a operação (função SECURITY DEFINER, uma transação: se algo falhar, nada é apagado).
-- Mantém pluggy_items (conexões com os bancos), veículos, notas fiscais, lista de compras e os outros grupos.

create table if not exists public.reset_backups (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  user_id uuid not null,
  criado_em timestamptz not null default now(),
  contagens jsonb not null default '{}'::jsonb,
  dados jsonb not null default '{}'::jsonb
);
alter table public.reset_backups enable row level security;
-- Sem policy de propósito: nenhum usuário lê pelo app; só o dono do projeto (service role) restaura.

create or replace function public.resetar_grupo_completo(p_confirmacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  g uuid;
  dados jsonb;
  contagens jsonb := '{}'::jsonb;
  n bigint;
begin
  if u is null then raise exception 'Sessão inválida. Entre de novo.'; end if;
  if upper(trim(coalesce(p_confirmacao, ''))) <> 'RESETAR' then raise exception 'Confirmação inválida. Digite RESETAR.'; end if;
  if not private.is_admin(u) then raise exception 'Somente administradores podem resetar os dados.'; end if;
  if private.bloqueio_exclusao_total() then raise exception 'Este administrador não possui permissão para excluir dados.'; end if;
  g := private.meu_grupo_id();
  if g is null then raise exception 'Seu usuário não pertence a um grupo ativo.'; end if;

  -- 1) backup completo em JSON, antes de qualquer exclusão
  dados := jsonb_build_object(
    'despesas', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from despesas x where x.grupo_id = g),
    'parcelas', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from parcelas x where x.grupo_id = g),
    'parcela_auditoria', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from parcela_auditoria x
        where x.despesa_id in (select id from despesas where grupo_id = g) or x.parcela_id in (select id from parcelas where grupo_id = g)),
    'fatura_mes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from fatura_mes x where x.grupo_id = g),
    'receitas', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from receitas x where x.grupo_id = g),
    'cartao_vinculos', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from cartao_vinculos x where x.grupo_id = g),
    'cartoes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from cartoes x where x.grupo_id = g),
    'bancos', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from bancos x where x.grupo_id = g),
    'categoria_regras', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from categoria_regras x where x.grupo_id = g),
    'categorias', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from categorias x where x.grupo_id = g),
    'configuracoes_casal', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from configuracoes_casal x where x.grupo_id = g),
    'pluggy_transacoes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from pluggy_transacoes x where x.user_id = u),
    'pluggy_contas', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from pluggy_contas x where x.user_id = u),
    'pluggy_investimentos', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from pluggy_investimentos x where x.user_id = u),
    'pluggy_emprestimos', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from pluggy_emprestimos x where x.user_id = u),
    'pluggy_sincronizacoes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from pluggy_sincronizacoes x where x.user_id = u)
  );
  insert into reset_backups (grupo_id, user_id, contagens, dados)
  values (g, u, (select jsonb_object_agg(k, jsonb_array_length(v)) from jsonb_each(dados) as e(k, v)), dados);

  -- 2) trava dos lançamentos importados desligada só aqui dentro (religa antes de sair)
  alter table public.parcelas disable trigger congelar_parcela_pluggy;
  alter table public.despesas disable trigger congelar_despesa_pluggy;
  alter table public.receitas disable trigger congelar_receita_pluggy;

  delete from parcela_auditoria where despesa_id in (select id from despesas where grupo_id = g) or parcela_id in (select id from parcelas where grupo_id = g);
  delete from parcelas where grupo_id = g; get diagnostics n = row_count; contagens := contagens || jsonb_build_object('parcelas', n);
  delete from fatura_mes where grupo_id = g; get diagnostics n = row_count; contagens := contagens || jsonb_build_object('fatura_mes', n);
  delete from despesas where grupo_id = g; get diagnostics n = row_count; contagens := contagens || jsonb_build_object('despesas', n);
  delete from cartao_vinculos where grupo_id = g;
  delete from cartoes where grupo_id = g; get diagnostics n = row_count; contagens := contagens || jsonb_build_object('cartoes', n);
  delete from bancos where grupo_id = g;
  delete from categoria_regras where grupo_id = g;
  delete from categorias where grupo_id = g; get diagnostics n = row_count; contagens := contagens || jsonb_build_object('categorias', n);
  delete from receitas where grupo_id = g; get diagnostics n = row_count; contagens := contagens || jsonb_build_object('receitas', n);
  delete from configuracoes_casal where grupo_id = g;
  delete from pluggy_transacoes where user_id = u;
  delete from pluggy_contas where user_id = u;
  delete from pluggy_investimentos where user_id = u;
  delete from pluggy_emprestimos where user_id = u;
  delete from pluggy_sincronizacoes where user_id = u;

  alter table public.parcelas enable trigger congelar_parcela_pluggy;
  alter table public.despesas enable trigger congelar_despesa_pluggy;
  alter table public.receitas enable trigger congelar_receita_pluggy;

  return contagens;
end;
$$;

revoke all on function public.resetar_grupo_completo(text) from public, anon;
grant execute on function public.resetar_grupo_completo(text) to authenticated;
