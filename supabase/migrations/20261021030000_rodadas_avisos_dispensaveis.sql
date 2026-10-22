-- Rodada dos avisos dispensáveis: quem dispensou não vê mais o aviso daquela rodada.
-- O admin "redispara" aumentando o número, e o aviso volta para todos.
alter table public.configuracoes_acesso_site
  add column if not exists rodada_aviso_convite integer not null default 1,
  add column if not exists rodada_aviso_privacidade integer not null default 1;
