-- Auditoria de segurança de 01/11/2026, item 7 (15/11/2026). Não altera dados.
-- 1) zz_teste_fn: função de teste esquecida, que qualquer visitante podia chamar. Ninguém usa no código.
drop function if exists public.zz_teste_fn();

-- 2) increment_parceria_cliques: só o servidor do site chama (parceria.functions.ts, com a chave de serviço).
--    Visitante e usuário logado não precisam executar direto.
revoke all on function public.increment_parceria_cliques() from public, anon, authenticated;
grant execute on function public.increment_parceria_cliques() to service_role;
