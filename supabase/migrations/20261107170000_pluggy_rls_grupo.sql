-- 07/11/2026: endurecimento de acesso antes de liberar o módulo open_finance para todos.
--
-- 1) Tabelas pluggy_* (itens, contas, transações, investimentos, empréstimos, sincronizações):
--    continuam SEM acesso direto pelo navegador/app. Toda leitura e escrita passa pelo servidor
--    (server functions do site e Edge Functions do app) com a service role, que filtra pelo
--    próprio usuário/grupo. Aqui só se reafirma: RLS ligada, nenhuma policy, sem grants para
--    anon/authenticated (remove qualquer policy criada fora das migrations).
-- 2) regras_pix_receita: o site lê e grava direto pelo navegador (RegrasPixReceita.tsx) e a tabela
--    não tinha migration no repositório (RLS desconhecida). Passa a valer: cada usuário só vê e
--    altera as próprias regras (created_by = auth.uid()), igual às server functions de PIX.
-- 3) configuracoes_open_finance: configuração GLOBAL (vale para a sincronização de todos). Leitura
--    para autenticados; gravação só para o admin do site (site_admins).
--
-- Idempotente: cada bloco só roda se a tabela existir; policies antigas são removidas e recriadas.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array['pluggy_items','pluggy_contas','pluggy_transacoes','pluggy_investimentos','pluggy_emprestimos','pluggy_sincronizacoes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
      execute format('grant all on public.%I to service_role', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
    end if;
  end loop;
end $$;

do $$
declare
  p record;
begin
  if to_regclass('public.regras_pix_receita') is null then
    return;
  end if;
  alter table public.regras_pix_receita enable row level security;
  alter table public.regras_pix_receita alter column created_by set default auth.uid();
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'regras_pix_receita' loop
    execute format('drop policy %I on public.regras_pix_receita', p.policyname);
  end loop;
  create policy regras_pix_receita_propria on public.regras_pix_receita
    for all to authenticated
    using (created_by = auth.uid())
    with check (created_by = auth.uid());
  revoke all on public.regras_pix_receita from anon;
  grant select, insert, update, delete on public.regras_pix_receita to authenticated;
  grant all on public.regras_pix_receita to service_role;
end $$;

do $$
declare
  p record;
begin
  if to_regclass('public.configuracoes_open_finance') is null then
    return;
  end if;
  alter table public.configuracoes_open_finance enable row level security;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'configuracoes_open_finance' loop
    execute format('drop policy %I on public.configuracoes_open_finance', p.policyname);
  end loop;
  create policy configuracoes_open_finance_leitura on public.configuracoes_open_finance
    for select to authenticated
    using (true);
  create policy configuracoes_open_finance_admin on public.configuracoes_open_finance
    for all to authenticated
    using (exists (select 1 from public.site_admins a where a.user_id = auth.uid()))
    with check (exists (select 1 from public.site_admins a where a.user_id = auth.uid()));
  revoke all on public.configuracoes_open_finance from anon;
  grant select, insert, update, delete on public.configuracoes_open_finance to authenticated;
  grant all on public.configuracoes_open_finance to service_role;
end $$;

notify pgrst, 'reload schema';
