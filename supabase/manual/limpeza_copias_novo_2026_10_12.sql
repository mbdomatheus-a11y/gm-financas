-- Limpeza das cópias criadas por tentativas repetidas de importação (2026-10-12).
-- Causa: a escolha "Criar um novo" gerava chave com horário; cada tentativa que falhava
-- depois (erro da despesa fixa) gravava a linha de novo. Mantém a cópia mais recente
-- de cada linha e apaga as demais (parcelas vão junto, em cascata).
-- Também remove lotes de importação vazios (sem fatura) dessas tentativas.
BEGIN;

WITH n AS (
  SELECT id, created_at,
    split_part(dedup_key, '#novo-', 1) || '|' ||
      regexp_replace(split_part(dedup_key, '#novo-', 2), '^[0-9]+-', '') AS grupo
  FROM public.despesas
  WHERE grupo_id = '00000000-0000-0000-0000-000000000001'
    AND dedup_key LIKE '%#novo-%'
), r AS (
  SELECT id, row_number() OVER (PARTITION BY grupo ORDER BY created_at DESC) AS rn FROM n
)
DELETE FROM public.despesas WHERE id IN (SELECT id FROM r WHERE rn > 1);

DELETE FROM public.import_lotes l
WHERE l.grupo_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM public.import_faturas f WHERE f.lote_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM public.importacao_backups b WHERE b.lote_id = l.id);

-- Conferência: deve mostrar 10 linhas "#novo" (uma por linha escolhida como nova).
SELECT count(*) AS copias_novo_restantes
FROM public.despesas
WHERE grupo_id = '00000000-0000-0000-0000-000000000001' AND dedup_key LIKE '%#novo-%';

COMMIT;
