-- 19/11/2026: ícone (logo do site) em cada link da página da bio. Busca automática ao salvar ou envio manual.
alter table public.bio_links add column if not exists icone_path text;
