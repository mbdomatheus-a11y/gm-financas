-- 08/11/2026: opção "Padrão original (Início)" na tela de abertura do site.
alter table public.configuracoes_acesso_site
  drop constraint if exists configuracoes_acesso_site_tela_inicial_padrao_check;
alter table public.configuracoes_acesso_site
  add constraint configuracoes_acesso_site_tela_inicial_padrao_check
  check (tela_inicial_padrao in ('inicio', 'financas', 'lista-compras', 'notas'));
notify pgrst, 'reload schema';
