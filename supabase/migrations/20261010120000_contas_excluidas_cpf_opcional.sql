-- Contas criadas pelo Google não têm CPF: o arquivo de conta excluída aceita CPF vazio.
alter table public.contas_excluidas alter column cpf drop not null;
