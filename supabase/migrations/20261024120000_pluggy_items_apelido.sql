-- Apelido da conexão do Open Finance, escolhido pelo usuário no app (2026-10-24).
-- O conector continua sendo o nome usado pela sincronização.
alter table public.pluggy_items add column if not exists apelido text;
