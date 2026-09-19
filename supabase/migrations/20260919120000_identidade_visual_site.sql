BEGIN;

CREATE TABLE IF NOT EXISTS public.identidade_visual_site (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  logo_path text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.identidade_visual_site (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.identidade_visual_site ENABLE ROW LEVEL SECURITY;
CREATE POLICY identidade_visual_leitura_publica ON public.identidade_visual_site FOR SELECT USING (true);
GRANT SELECT ON public.identidade_visual_site TO anon, authenticated;
GRANT ALL ON public.identidade_visual_site TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site_assets', 'site_assets', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';
COMMIT;
