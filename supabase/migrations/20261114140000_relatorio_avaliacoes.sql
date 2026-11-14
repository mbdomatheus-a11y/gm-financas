-- Relatório de avaliações das telas (Administração): admin lê todas as linhas de avaliacoes_tela.
drop policy if exists "avaliacoes_tela_ler_admin" on public.avaliacoes_tela;
create policy "avaliacoes_tela_ler_admin" on public.avaliacoes_tela for select to authenticated
  using (private.is_admin(auth.uid()));
