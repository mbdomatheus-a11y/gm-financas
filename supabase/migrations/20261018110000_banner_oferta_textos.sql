-- Textos do banner de oferta editáveis pelo admin.
ALTER TABLE public.configuracoes_acesso_site
  ADD COLUMN IF NOT EXISTS banner_oferta_titulo text NOT NULL DEFAULT 'Oferta por tempo limitado',
  ADD COLUMN IF NOT EXISTS banner_oferta_texto text NOT NULL DEFAULT 'Crie sua conta grátis e garanta acesso completo.',
  ADD COLUMN IF NOT EXISTS banner_oferta_botao text NOT NULL DEFAULT 'Criar conta grátis';
