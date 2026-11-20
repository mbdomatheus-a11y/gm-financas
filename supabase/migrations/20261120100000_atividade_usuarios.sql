-- 20/11/2026: "Última atividade" do admin contava só o site (eventos_sessao). Quem usa só o app aparecia
-- "Sem acesso". Esta função lê o último login e a última renovação de sessão (o app renova enquanto é usado).
create or replace function public.admin_atividade_usuarios()
returns table (user_id uuid, ultimo_login timestamptz, ultima_sessao timestamptz)
language sql
security definer
set search_path = ''
as $$
  select u.id,
         u.last_sign_in_at,
         (select max(coalesce(s.refreshed_at, s.updated_at, s.created_at)) from auth.sessions s where s.user_id = u.id)
  from auth.users u
$$;
revoke all on function public.admin_atividade_usuarios() from public, anon, authenticated;
grant execute on function public.admin_atividade_usuarios() to service_role;
