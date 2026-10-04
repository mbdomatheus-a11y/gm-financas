-- Garante a coluna cadastro_livre_habilitado em configuracoes_acesso_site com default TRUE
ALTER TABLE public.configuracoes_acesso_site
  ADD COLUMN IF NOT EXISTS cadastro_livre_habilitado boolean NOT NULL DEFAULT true;

-- Atualiza a linha mestre para TRUE caso esteja nula ou falsa
UPDATE public.configuracoes_acesso_site
SET cadastro_livre_habilitado = true
WHERE id = true AND cadastro_livre_habilitado IS NOT TRUE;

NOTIFY pgrst, 'reload schema';
