create or replace function private.conta_ativa()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and ativo = true);
$$;

revoke all on function private.conta_ativa() from public, anon;
grant execute on function private.conta_ativa() to authenticated, service_role;

create policy exames_conta_ativa on public.exames_registros as restrictive
  for all to authenticated using (private.conta_ativa()) with check (private.conta_ativa());
create policy medicoes_conta_ativa on public.exame_medicoes as restrictive
  for all to authenticated using (private.conta_ativa()) with check (private.conta_ativa());
create policy notificacoes_conta_ativa on public.notificacoes_usuario as restrictive
  for all to authenticated using (private.conta_ativa()) with check (private.conta_ativa());
create policy alertas_conta_ativa on public.historico_alertas_usuario as restrictive
  for all to authenticated using (private.conta_ativa()) with check (private.conta_ativa());
create policy layouts_conta_ativa on public.layout_solicitacoes as restrictive
  for select to authenticated using (private.conta_ativa());
create policy aceites_conta_ativa on public.aceites_documentos as restrictive
  for select to authenticated using (private.conta_ativa());
