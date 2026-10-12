-- Reset das 6 faturas importadas em 12/10 para reimportar com o código corrigido.
-- Motivo: tentativas repetidas de importação deixaram linhas faltando (Santander, Itaú,
-- Pernambucanas) e cópias antigas de parcelamentos com calendário errado (Wilca, Vetnasa,
-- Qoculos, Shoppingde). Mantém: despesas fixas, despesas de outros meses/faturas, receitas,
-- regras de categoria e aprendizado. Guarda cópia de segurança antes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.backup_20261012b_despesas AS
  SELECT * FROM public.despesas WHERE grupo_id = '00000000-0000-0000-0000-000000000001';
CREATE TABLE IF NOT EXISTS public.backup_20261012b_parcelas AS
  SELECT p.* FROM public.parcelas p JOIN public.despesas d ON d.id = p.despesa_id
  WHERE d.grupo_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.backup_20261012b_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_20261012b_parcelas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_20261012b_despesas, public.backup_20261012b_parcelas FROM anon, authenticated;

-- 1. Lançamentos (não fixos) gravados pelas 6 faturas importadas.
DELETE FROM public.despesas d
USING public.import_faturas f, public.import_lotes l
WHERE d.fatura_id = f.id AND f.lote_id = l.id
  AND l.grupo_id = '00000000-0000-0000-0000-000000000001'
  AND d.tipo <> 'fixa';

-- 2. Cópias antigas de parcelamentos com calendário errado (dia 08, um mês antes).
DELETE FROM public.despesas WHERE id IN (
  '5db9541d-6194-4fe1-a05e-6a0b53936de7', -- Auto Acessorios Wilca 5x (antiga)
  'c7515937-f1f8-4537-ba67-1090af59da42', -- Qoculos 10x (antiga)
  '6cb6071d-b8d9-4bbc-b664-07f94dd0ec25', -- Shoppingde 12x (antiga)
  'c7795232-02c3-4523-b76d-ba9cfa2011d1', -- Vetnasa 9x (antiga)
  '07e067e0-4099-4d81-b270-bfecbdaf909e'  -- Vetnasa 6x (antiga)
);

-- 3. Backups de substituição e lotes das tentativas (as faturas saem em cascata).
DELETE FROM public.importacao_backups WHERE grupo_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.import_lotes WHERE grupo_id = '00000000-0000-0000-0000-000000000001';

-- Conferência
SELECT
  (SELECT count(*) FROM public.despesas WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS despesas_restantes,
  (SELECT count(*) FROM public.import_lotes WHERE grupo_id = '00000000-0000-0000-0000-000000000001') AS lotes,
  (SELECT count(*) FROM public.despesas WHERE grupo_id = '00000000-0000-0000-0000-000000000001' AND tipo = 'fixa') AS fixas;

COMMIT;
