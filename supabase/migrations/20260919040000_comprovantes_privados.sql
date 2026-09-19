BEGIN;

-- Alternativa ao Google Drive: os comprovantes ficam em um bucket privado.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes', 'comprovantes', false, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS comprovantes_por_grupo ON storage.objects;
CREATE POLICY comprovantes_por_grupo ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND EXISTS (
    SELECT 1 FROM public.notas_fiscais AS nota
    WHERE nota.id::text = split_part(name, '/', 1)
      AND nota.grupo_id = private.meu_grupo_id()
  )
)
WITH CHECK (
  bucket_id = 'comprovantes'
  AND EXISTS (
    SELECT 1 FROM public.notas_fiscais AS nota
    WHERE nota.id::text = split_part(name, '/', 1)
      AND nota.grupo_id = private.meu_grupo_id()
  )
);

COMMIT;
