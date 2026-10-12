-- 1) Apaga as "correções aprendidas" falsas (bug: a chave misturava linhas de PDFs diferentes).
-- 2) Apaga de novo os lançamentos das faturas importadas, para reimportar sem as trocas.
BEGIN;

DELETE FROM public.fatura_correcoes_usuario
WHERE grupo_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.despesas d
USING public.import_faturas f, public.import_lotes l
WHERE d.fatura_id = f.id AND f.lote_id = l.id
  AND l.grupo_id = '00000000-0000-0000-0000-000000000001'
  AND d.tipo <> 'fixa';

DELETE FROM public.importacao_backups WHERE grupo_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.import_lotes WHERE grupo_id = '00000000-0000-0000-0000-000000000001';

SELECT
  (SELECT count(*) FROM public.fatura_correcoes_usuario WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS correcoes,
  (SELECT count(*) FROM public.import_lotes WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS lotes,
  (SELECT count(*) FROM public.despesas WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS despesas_restantes;

COMMIT;
