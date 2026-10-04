BEGIN;

-- Melhoria do módulo "Onde Está?" (2026-09-26, mensagem B do backlog): a
-- ideia é permitir local -> cômodo/detalhe do contêiner (ex.: "guarda-roupa,
-- caixa de sapato cinza, lado esquerdo") -> item guardado -> data de compra
-- -> data de validade, tudo opcional. `locais_armazenamento` já suporta
-- hierarquia via local_pai_id (não usada pela UI antiga); só faltam colunas
-- de data/quantidade úteis de busca e um texto livre pra detalhe do local.

ALTER TABLE public.locais_armazenamento
  ADD COLUMN IF NOT EXISTS detalhe text;

ALTER TABLE public.itens_armazenados
  ADD COLUMN IF NOT EXISTS data_compra date,
  ADD COLUMN IF NOT EXISTS data_validade date;

-- Índices simples pra busca por nome (item e local) usada pelo campo
-- "digite e encontre" no topo da lista (via ILIKE) — volume esperado é
-- pequeno (uso doméstico por grupo), então um índice comum já basta, sem
-- depender da extensão pg_trgm.
CREATE INDEX IF NOT EXISTS idx_itens_armazenados_nome ON public.itens_armazenados (lower(nome));
CREATE INDEX IF NOT EXISTS idx_locais_armazenamento_nome ON public.locais_armazenamento (lower(nome));

NOTIFY pgrst, 'reload schema';
COMMIT;
