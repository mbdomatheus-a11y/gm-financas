-- Limpeza da importação do grupo "Matheus & família" (2026-10-12).
-- Execute no SQL Editor do Supabase (projeto control+all), em um único bloco.
-- Backups já criados: backup_20261012_despesas, backup_20261012_parcelas,
-- backup_20261012_import_lotes, backup_20261012_fatura_mes.
-- Mantém: categoria_regras, importacao_preferencias (aprendizado), classificacao_voto e receitas.

BEGIN;

UPDATE public.importacao_preferencias
   SET despesa_id = NULL
 WHERE grupo_id = '00000000-0000-0000-0000-000000000001'
   AND despesa_id IS NOT NULL;

DELETE FROM public.fatura_mes        WHERE grupo_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.importacao_backups WHERE grupo_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.despesas          WHERE grupo_id = '00000000-0000-0000-0000-000000000001';  -- apaga parcelas em cascata
DELETE FROM public.import_lotes      WHERE grupo_id = '00000000-0000-0000-0000-000000000001';  -- apaga import_faturas em cascata

-- Confirmação: tudo deve estar em 0, exceto regras, preferências, votos e receitas.
SELECT
  (SELECT count(*) FROM public.despesas     WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS despesas,
  (SELECT count(*) FROM public.import_lotes WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS lotes,
  (SELECT count(*) FROM public.categoria_regras WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS regras,
  (SELECT count(*) FROM public.receitas     WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS receitas;

COMMIT;

-- Migração pendente: esquecer classificação aprendida (botão Esquecer em De Para).
-- Conteúdo idêntico a supabase/migrations/20261011150000_esquecer_classificacao.sql
-- Esquecer classificação aprendida (2026-10-11).
-- Remove a memória do próprio grupo para um estabelecimento (escopo classificacao)
-- e também o voto que esse grupo deu para o aprendizado global. Não afeta
-- lançamentos já gravados nem os votos de outros grupos.

CREATE OR REPLACE FUNCTION public.esquecer_classificacao(p_chave text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g uuid;
BEGIN
  SELECT grupo_id INTO g FROM public.profiles WHERE id = auth.uid();
  IF g IS NULL THEN
    RAISE EXCEPTION 'Sem grupo para esquecer classificação.';
  END IF;
  DELETE FROM public.importacao_preferencias
   WHERE grupo_id = g AND chave = p_chave AND escopo = 'classificacao';
  DELETE FROM public.classificacao_voto
   WHERE grupo_id = g AND chave = p_chave;
END;
$$;

REVOKE ALL ON FUNCTION public.esquecer_classificacao(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.esquecer_classificacao(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
