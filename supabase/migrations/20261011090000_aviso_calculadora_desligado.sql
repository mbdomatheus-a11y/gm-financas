-- Aviso da calculadora (Ferramentas) passa a vir desligado.
-- O aviso agora nunca bloqueia o uso; o admin liga em Administração quando quiser.
ALTER TABLE public.configuracoes_acesso_site
  ALTER COLUMN exibir_aviso_calculadora SET DEFAULT false;

UPDATE public.configuracoes_acesso_site
  SET exibir_aviso_calculadora = false
  WHERE id = true;
