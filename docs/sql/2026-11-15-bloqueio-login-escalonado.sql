-- Bloqueio de login (15/11/2026), padrão de mercado: 4 erros livres; a partir do 5º espera crescente
-- (5, 10, 15, 30 e 60 min). Antes bloqueava já no 3º erro e chegava a 24 h. Contador zera após 24 h sem erro.
create or replace function public.registrar_tentativa_login(p_hash text, p_sucesso boolean)
returns table(bloqueado_ate timestamptz, falhas integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_falhas integer; v_bloqueio timestamptz;
begin
  if p_sucesso then
    delete from public.login_tentativas where identificador_hash = p_hash;
    return query select null::timestamptz, 0;
    return;
  end if;
  update public.login_tentativas set falhas = 0, bloqueado_ate = null
    where identificador_hash = p_hash and atualizado_em < now() - interval '24 hours';
  insert into public.login_tentativas as l (identificador_hash, falhas, atualizado_em)
  values (p_hash, 1, now())
  on conflict (identificador_hash) do update
    set falhas = l.falhas + 1, atualizado_em = now()
  returning l.falhas into v_falhas;
  if v_falhas >= 5 then
    v_bloqueio := now() + case
      when v_falhas = 5 then interval '5 minutes'
      when v_falhas = 6 then interval '10 minutes'
      when v_falhas = 7 then interval '15 minutes'
      when v_falhas = 8 then interval '30 minutes'
      else interval '60 minutes' end;
    update public.login_tentativas set bloqueado_ate = v_bloqueio where identificador_hash = p_hash;
  else
    v_bloqueio := null;
  end if;
  return query select v_bloqueio, v_falhas;
end $function$;

-- Quem cria uma senha nova pelo "Esqueci minha senha" (provou que é dono do e-mail) entra na hora,
-- sem esperar o fim do bloqueio. Mesmo hash do login: sha256 do e-mail em minúsculas.
create or replace function public.liberar_bloqueio_login(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.login_tentativas t
   where t.identificador_hash in (
     select encode(extensions.digest(lower(trim(e)), 'sha256'), 'hex')
       from (
         select u.email as e from auth.users u where u.id = p_user_id
         union select p.email from public.profiles p where p.id = p_user_id
         union select p.cpf from public.profiles p where p.id = p_user_id and p.cpf is not null
       ) x
      where e is not null
   );
end $function$;
revoke all on function public.liberar_bloqueio_login(uuid) from public, anon, authenticated;
grant execute on function public.liberar_bloqueio_login(uuid) to service_role;
