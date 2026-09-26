-- Item 2 do backlog do proprietário: cota de convites configurável pelo
-- admin do site (padrão 3, ajustável), e o admin do site pode convidar de
-- forma ILIMITADA independente da cota configurada.
ALTER TABLE public.configuracoes_acesso_site
  ADD COLUMN IF NOT EXISTS cota_convites integer NOT NULL DEFAULT 3
    CHECK (cota_convites BETWEEN 1 AND 1000);

NOTIFY pgrst, 'reload schema';
