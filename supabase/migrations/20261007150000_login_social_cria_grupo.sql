-- Login social (Google/Microsoft) criava usuário e perfil SEM grupo, SEM papel,
-- com nome "Usuário" e senha_temporaria=true: a conta nascia inutilizável
-- (RLS por grupo_id bloqueava tudo). Agora o gatilho completa a conta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_nome text;
  v_grupo uuid;
begin
  if v_provider = 'email' then
    -- Cadastro por e-mail/convite: as server functions completam grupo e perfil.
    insert into public.profiles (id, nome, cpf, senha_temporaria)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'nome', 'Usuário'),
      coalesce(new.raw_user_meta_data->>'cpf', ''),
      coalesce((new.raw_user_meta_data->>'senha_temporaria')::boolean, true)
    )
    on conflict (id) do nothing;
    return new;
  end if;

  v_nome := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuário'
  );
  insert into public.grupos (nome, criado_por)
  values (split_part(v_nome, ' ', 1) || '''s Group', new.id)
  returning id into v_grupo;

  insert into public.profiles (id, nome, cpf, email, grupo_id, ativo, senha_temporaria)
  values (new.id, v_nome, null, lower(new.email), v_grupo, true, false)
  on conflict (id) do update
    set grupo_id = coalesce(public.profiles.grupo_id, excluded.grupo_id),
        nome = case when public.profiles.nome = 'Usuário' then excluded.nome else public.profiles.nome end,
        email = coalesce(public.profiles.email, excluded.email),
        senha_temporaria = false;

  insert into public.user_roles (user_id, role) values (new.id, 'admin')
  on conflict (user_id, role) do nothing;

  insert into public.aceites_documentos (user_id, documento, versao)
  values (new.id, 'termos_uso', '2026-09-19'), (new.id, 'aviso_privacidade', '2026-09-19')
  on conflict do nothing;

  return new;
end;
$function$;

-- Reparo das contas sociais já criadas sem grupo.
do $$
declare r record; v_grupo uuid; v_nome text;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data m
    from auth.users u join public.profiles p on p.id = u.id
    where p.grupo_id is null and coalesce(u.raw_app_meta_data->>'provider','email') <> 'email'
  loop
    v_nome := coalesce(nullif(r.m->>'full_name',''), nullif(r.m->>'name',''), split_part(r.email,'@',1));
    insert into public.grupos (nome, criado_por) values (split_part(v_nome,' ',1) || '''s Group', r.id) returning id into v_grupo;
    update public.profiles set grupo_id = v_grupo, nome = v_nome, email = lower(r.email), cpf = null, senha_temporaria = false, ativo = true where id = r.id;
    insert into public.user_roles (user_id, role) values (r.id, 'admin') on conflict (user_id, role) do nothing;
    insert into public.aceites_documentos (user_id, documento, versao)
      values (r.id, 'termos_uso', '2026-09-19'), (r.id, 'aviso_privacidade', '2026-09-19') on conflict do nothing;
  end loop;
end $$;
