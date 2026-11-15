-- Reset completo de CONTA DE TESTE (14/11/2026). Usado pela Administração para gravar vídeos.
-- Só duas contas podem ser resetadas, fixas aqui dentro (id + e-mail conferidos juntos):
--   21c7585b-f5f8-4cfc-8392-0c5a23004516  mwathews@gmail.com      (Marcus NT)
--   125ce801-6bee-40b0-b9bf-b519b2d66801  artfoxbrasil@gmail.com  (Marcus Nt)
-- Uma transação só: se qualquer passo falhar, nada é apagado. O backup completo fica em reset_backups.
-- Mantém: login, senha, nome, e-mail, papel, permissões, convites, chamados, aceite dos termos,
-- conexões de banco (pluggy_items), registro de arquivos enviados e históricos de acesso.

alter table public.reset_backups add column if not exists tipo text not null default 'grupo';
alter table public.reset_backups add column if not exists criado_por uuid;

create or replace function private.tabelas_reset_conta_teste(p_alvo uuid, p_grupo uuid)
returns table (tabela text, coluna text, valor uuid)
language sql
stable
set search_path = public
as $$
  -- 1) tudo que é do grupo
  select c.table_name::text, 'grupo_id'::text, p_grupo
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.column_name = 'grupo_id'
    and c.table_name !~ '^(_?backup|bkp)_'
    and c.table_name not in (
      'profiles', 'contas_excluidas', 'reset_backups', 'permissoes', 'convites', 'convites_grupo',
      'chamados_suporte', 'vinculos_open_finance', 'oracle_storage_arquivos'
    )
  union all
  -- 2) estado pessoal da conta (avisos, tour, preferências, dados importados dos bancos)
  select c.table_name::text, 'user_id'::text, p_alvo
  from information_schema.columns c
  where c.table_schema = 'public' and c.column_name = 'user_id'
    and c.table_name in (
      'alertas_lidos', 'alertas_ocultos', 'avisos_dispensados', 'avaliacoes_tela', 'calendario_links',
      'comunicado_aceites', 'historico_alertas_usuario', 'notificacoes_usuario', 'pesquisa_dores',
      'preferencias_notificacao', 'preferencias_usuario', 'tour_concluido',
      'pluggy_transacoes', 'pluggy_investimentos', 'pluggy_emprestimos', 'pluggy_sincronizacoes',
      'gamificacao_eventos', 'gamificacao_usuario'
    )
  union all
  -- 3) itens sem grupo, ligados a quem criou
  select c.table_name::text, 'created_by'::text, p_alvo
  from information_schema.columns c
  where c.table_schema = 'public' and c.column_name = 'created_by'
    and c.table_name in ('comprovantes', 'nota_arquivos', 'nota_vinculos', 'regras_pix_receita', 'subcategorias');
$$;

create or replace function public.resetar_conta_teste(p_ator uuid, p_alvo uuid, p_confirmacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  permitidas constant uuid[] := array[
    '21c7585b-f5f8-4cfc-8392-0c5a23004516',
    '125ce801-6bee-40b0-b9bf-b519b2d66801'
  ]::uuid[];
  emails constant text[] := array['mwathews@gmail.com', 'artfoxbrasil@gmail.com'];
  g uuid;
  email_alvo text;
  dados jsonb := '{}'::jsonb;
  contagens jsonb := '{}'::jsonb;
  linhas jsonb;
  n bigint;
  t record;
  pendentes int := 0;
  ultimo_erro text := '';
begin
  if p_ator is null or not exists (select 1 from site_admins s where s.user_id = p_ator) then
    raise exception 'Só a administração do site pode resetar uma conta de teste.';
  end if;
  if upper(trim(coalesce(p_confirmacao, ''))) <> 'RESETAR' then
    raise exception 'Confirmação inválida. Digite RESETAR.';
  end if;
  if p_alvo is null or not (p_alvo = any (permitidas)) then
    raise exception 'Esta conta não é uma conta de teste. Reset recusado.';
  end if;
  select lower(u.email) into email_alvo from auth.users u where u.id = p_alvo;
  if email_alvo is null or not (email_alvo = any (emails)) then
    raise exception 'O e-mail desta conta não confere com a conta de teste. Reset recusado.';
  end if;
  if exists (select 1 from site_admins s where s.user_id = p_alvo) then
    raise exception 'A conta da administração do site nunca é resetada.';
  end if;
  select p.grupo_id into g from profiles p where p.id = p_alvo;
  if g is null then
    raise exception 'A conta de teste está sem grupo.';
  end if;
  if exists (
    select 1 from profiles p
    where p.id <> p_alvo and (p.grupo_id = g or p.grupo_secundario_id = g)
  ) then
    raise exception 'O grupo desta conta tem outras pessoas. Reset recusado para não apagar dados delas.';
  end if;

  -- 1) backup completo, antes de qualquer exclusão
  for t in select * from private.tabelas_reset_conta_teste(p_alvo, g) loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.%I = $1',
      t.tabela, t.coluna
    ) into linhas using t.valor;
    if jsonb_array_length(linhas) > 0 then
      dados := dados || jsonb_build_object(t.tabela, coalesce(dados -> t.tabela, '[]'::jsonb) || linhas);
    end if;
  end loop;
  dados := dados || jsonb_build_object(
    'parcela_auditoria', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from parcela_auditoria x
        where x.despesa_id in (select id from despesas where grupo_id = g)
           or x.parcela_id in (select id from parcelas where grupo_id = g)),
    'profiles', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from profiles x where x.id = p_alvo)
  );
  insert into reset_backups (grupo_id, user_id, contagens, dados, tipo, criado_por)
  values (
    g, p_alvo,
    (select coalesce(jsonb_object_agg(k, jsonb_array_length(v)), '{}'::jsonb) from jsonb_each(dados) as e(k, v)),
    dados, 'conta_teste', p_ator
  );

  -- 2) apaga. Trava dos lançamentos importados desligada só aqui dentro.
  alter table public.parcelas disable trigger congelar_parcela_pluggy;
  alter table public.despesas disable trigger congelar_despesa_pluggy;
  alter table public.receitas disable trigger congelar_receita_pluggy;

  delete from parcela_auditoria
  where despesa_id in (select id from despesas where grupo_id = g)
     or parcela_id in (select id from parcelas where grupo_id = g);

  -- Repete porque a ordem de dependência entre tabelas pode variar.
  for passada in 1..6 loop
    pendentes := 0;
    for t in select * from private.tabelas_reset_conta_teste(p_alvo, g) loop
      begin
        execute format('delete from public.%I where %I = $1', t.tabela, t.coluna) using t.valor;
        get diagnostics n = row_count;
        if n > 0 then
          contagens := contagens || jsonb_build_object(t.tabela, coalesce((contagens ->> t.tabela)::bigint, 0) + n);
        end if;
      exception when foreign_key_violation then
        pendentes := pendentes + 1;
        ultimo_erro := t.tabela || ': ' || sqlerrm;
      end;
    end loop;
    exit when pendentes = 0;
  end loop;
  if pendentes > 0 then
    raise exception 'Não foi possível apagar tudo (%). Nada foi alterado.', ultimo_erro;
  end if;

  alter table public.parcelas enable trigger congelar_parcela_pluggy;
  alter table public.despesas enable trigger congelar_despesa_pluggy;
  alter table public.receitas enable trigger congelar_receita_pluggy;

  -- 3) perfil volta ao estado de conta recém-criada (login, nome e e-mail ficam)
  update profiles set
    horas_trabalho_mes = null,
    renda_liquida_informada = null,
    compromissos_fixos_informados = null,
    perfil_financeiro_respondido_em = null,
    perfil_financeiro_pulado_em = null
  where id = p_alvo;

  insert into admin_audit_logs (ator_id, acao, alvo_id, detalhes)
  values (p_ator, 'conta_teste_resetada', p_alvo, jsonb_build_object('grupo_id', g, 'apagados', contagens));

  return contagens;
end;
$$;

revoke all on function public.resetar_conta_teste(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resetar_conta_teste(uuid, uuid, text) to service_role;
revoke all on function private.tabelas_reset_conta_teste(uuid, uuid) from public, anon, authenticated;

-- Quando a MINHA conta foi resetada pela última vez (só contas de teste têm valor). O site e o app
-- usam isso para tratar a conta como nova de novo (boas-vindas, primeiros passos, tour).
create or replace function public.meu_ultimo_reset_teste()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(r.criado_em) from reset_backups r where r.user_id = auth.uid() and r.tipo = 'conta_teste';
$$;
revoke all on function public.meu_ultimo_reset_teste() from public, anon;
grant execute on function public.meu_ultimo_reset_teste() to authenticated;
