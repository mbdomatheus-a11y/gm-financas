-- Idioma escolhido pelo usuário (null = segue o país/navegador).
alter table public.preferencias_usuario add column if not exists idioma text;
