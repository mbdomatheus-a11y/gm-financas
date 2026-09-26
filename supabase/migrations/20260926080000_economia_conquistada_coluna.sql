-- Item 1 do novo backlog (2026-09-26): a marcação "Despesa Ajustada /
-- Economia Conquistada" (checkbox em Despesas) era guardada como um hack de
-- texto — prefixo "[ECONOMIA_CONQUISTADA] " dentro de `observacoes` — em vez
-- de uma coluna própria. Isso quebrava ao editar a despesa (o formulário não
-- reconstruía o estado do checkbox a partir do texto) e arriscava colidir
-- com uma observação legítima da pessoa que contivesse esse texto. Agora é
-- uma coluna boolean real.
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS economia_conquistada boolean NOT NULL DEFAULT false;

-- Backfill: migra o marcador antigo para a coluna nova e limpa o texto.
UPDATE public.despesas
SET economia_conquistada = true
WHERE observacoes LIKE '[ECONOMIA_CONQUISTADA]%' AND economia_conquistada = false;

UPDATE public.despesas
SET observacoes = NULLIF(TRIM(regexp_replace(observacoes, '^\[ECONOMIA_CONQUISTADA\]\s*', '')), '')
WHERE observacoes LIKE '[ECONOMIA_CONQUISTADA]%';

NOTIFY pgrst, 'reload schema';
