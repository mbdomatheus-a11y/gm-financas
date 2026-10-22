-- Links da administração: conteúdo de até 500 mil caracteres (antes 100 mil).
alter table public.links_admin drop constraint if exists links_admin_conteudo_check;
alter table public.links_admin
  add constraint links_admin_conteudo_check check (char_length(conteudo) between 1 and 500000);
