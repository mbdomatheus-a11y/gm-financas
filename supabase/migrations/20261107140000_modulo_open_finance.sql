-- 07/11/2026: Open Finance (Pluggy) vira módulo global DESLIGADO por padrão.
--
-- Igual ao módulo "links" (20261008100000_links_admin_modulo_links.sql): a
-- linha nasce com habilitado = false. O admin do site continua vendo a tela
-- /pluggy (listarModulosDisponiveis devolve habilitado = true para admin) e
-- pode liberar para todos ou por usuário na Administração (modulos_usuario).
--
-- Não remove nada da integração Pluggy. Idempotente: se a linha já existir,
-- mantém como está (não religa nem desliga).

insert into public.modulos_globais (modulo, nome, habilitado)
values ('open_finance', 'Open Finance', false)
on conflict (modulo) do nothing;

notify pgrst, 'reload schema';
