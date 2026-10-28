-- O próprio usuário pede para ver os avisos de novo (28/10/2026): Configurações no app, Minha conta no site.
create or replace function public.redefinir_meus_avisos()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  delete from public.avisos_dispensados where user_id = auth.uid();
  delete from public.tour_concluido where user_id = auth.uid();
  insert into public.avisos_redefinicoes (alvo_user_id, criado_por) values (auth.uid(), auth.uid());
end;
$$;
revoke all on function public.redefinir_meus_avisos() from public, anon;
grant execute on function public.redefinir_meus_avisos() to authenticated;
