-- 01/11/2026: subcategorias são sugestões compartilhadas. Todos leem (a sugestão fica mais forte com o uso),
-- mas cada usuário só cria, edita e apaga as subcategorias que criou.
drop policy if exists "subcategorias_all" on public.subcategorias;
create policy subcategorias_ler_todas on public.subcategorias
  for select to authenticated using (true);
create policy subcategorias_criar_proprias on public.subcategorias
  for insert to authenticated with check (created_by = auth.uid());
create policy subcategorias_editar_proprias on public.subcategorias
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy subcategorias_apagar_proprias on public.subcategorias
  for delete to authenticated using (created_by = auth.uid());
