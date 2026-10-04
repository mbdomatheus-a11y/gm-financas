-- Item 2 do novo backlog (2026-09-26): valor de "economia total" exibido
-- publicamente na home, editável pelo admin do site. Mesmo padrão já usado
-- em `identidade_visual_site` (logo) e `configuracoes_acesso_site`: tabela
-- singleton, leitura pública (qualquer visitante do site, sem login), só o
-- service_role grava (a escrita é sempre feita por uma server function que
-- confere `site_admins` antes).
CREATE TABLE IF NOT EXISTS public.estatisticas_site_publicas (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  economia_total_exibida numeric,
  economia_total_atualizado_em timestamptz,
  economia_total_atualizado_por uuid
);
INSERT INTO public.estatisticas_site_publicas (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.estatisticas_site_publicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estatisticas_site_publicas_leitura_publica ON public.estatisticas_site_publicas;
CREATE POLICY estatisticas_site_publicas_leitura_publica ON public.estatisticas_site_publicas
  FOR SELECT USING (true);
GRANT SELECT ON public.estatisticas_site_publicas TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.estatisticas_site_publicas FROM anon, authenticated;
GRANT ALL ON public.estatisticas_site_publicas TO service_role;

NOTIFY pgrst, 'reload schema';
