-- Item 15 do backlog do proprietário: revisão de segurança. Esta migração
-- fecha uma brecha encontrada na revisão: a função `registrar_tentativa_login`
-- é SECURITY DEFINER (roda com privilégio elevado, ignora RLS) e deveria ser
-- chamável só pelo service_role (só as server functions do app deveriam
-- registrar tentativas de login). A migração anterior
-- (20260919100000_administracao_privacidade_modulos.sql) já tentou
-- `REVOKE ALL ... FROM PUBLIC`, mas isso não remove um GRANT explícito que
-- o Supabase costuma aplicar por padrão a `anon`/`authenticated` em funções
-- novas do schema public — por isso o EXECUTE continuava liberado para
-- essas duas roles em produção, permitindo que qualquer pessoa (sem
-- autenticação) chamasse a função via PostgREST/RPC e bloqueasse a conta de
-- qualquer usuário só sabendo o e-mail/CPF dele (hash sha256 é trivial de
-- reproduzir), sem nunca tentar a senha real.
REVOKE EXECUTE ON FUNCTION public.registrar_tentativa_login(text, boolean) FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
