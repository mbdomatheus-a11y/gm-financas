-- 18/11/2026: modelo do Início (7 modelos e ajustes por aba), por pessoa. App e site leem e gravam aqui.
-- No workspace conjunto cada pessoa tem a sua linha em preferencias_usuario (RLS por user_id já existente).
alter table public.preferencias_usuario add column if not exists inicio_modelo jsonb;
