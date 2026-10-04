BEGIN;

-- Item 4 do backlog de 2026-09-26: vídeo de demonstração administrável na
-- home. Reaproveita a tabela singleton identidade_visual_site (mesmo padrão
-- de leitura pública / escrita só pelo admin já usado pra logo), só
-- acrescentando a coluna do caminho do vídeo.
ALTER TABLE public.identidade_visual_site
  ADD COLUMN IF NOT EXISTS video_demonstracao_path text;

-- Bucket próprio pra vídeo: limite maior (100 MB) e mimetypes de vídeo,
-- diferente do site_assets (5 MB, só imagens) usado pra logo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site_videos', 'site_videos', true, 104857600, ARRAY['video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';
COMMIT;
