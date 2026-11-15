-- Esqueci minha senha dentro do app (15/11/2026): o código de 6 dígitos usa a mesma tabela do cadastro.
-- Só libera a nova finalidade; não altera dados.
alter table public.verificacoes_email drop constraint if exists verificacoes_email_finalidade_check;
alter table public.verificacoes_email
  add constraint verificacoes_email_finalidade_check
  check (finalidade = any (array['cadastro'::text, 'troca_email'::text, 'recuperar_senha'::text]));
