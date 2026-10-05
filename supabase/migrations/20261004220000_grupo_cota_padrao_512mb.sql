-- Cota inicial de armazenamento por grupo: 512 MB (antes 1 GB).
ALTER TABLE public.grupos ALTER COLUMN oracle_storage_cota_bytes SET DEFAULT 536870912;
