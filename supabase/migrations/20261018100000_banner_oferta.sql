-- Banner de oferta com contador na home pública.
-- Janela fixa: início e fim gravados; o contador nunca reinicia sozinho.
-- Desativar no meio não zera nada; reativar mostra o tempo que falta até o fim.
ALTER TABLE public.configuracoes_acesso_site
  ADD COLUMN IF NOT EXISTS banner_oferta_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banner_oferta_inicio timestamptz NULL,
  ADD COLUMN IF NOT EXISTS banner_oferta_fim timestamptz NULL;

ALTER TABLE public.configuracoes_acesso_site
  DROP CONSTRAINT IF EXISTS configuracoes_acesso_site_banner_oferta_janela_check;

ALTER TABLE public.configuracoes_acesso_site
  ADD CONSTRAINT configuracoes_acesso_site_banner_oferta_janela_check
  CHECK (
    banner_oferta_inicio IS NULL
    OR banner_oferta_fim IS NULL
    OR banner_oferta_fim > banner_oferta_inicio
  );
