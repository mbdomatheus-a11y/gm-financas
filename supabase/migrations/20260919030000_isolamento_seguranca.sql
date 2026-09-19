-- Impede que um usuário mude a própria identidade/grupo pela API pública.
-- Alterações administrativas excepcionais devem usar uma função de servidor
-- autenticada, nunca um UPDATE direto com a chave publicável.
BEGIN;

CREATE OR REPLACE FUNCTION private.proteger_identidade_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.grupo_id IS DISTINCT FROM OLD.grupo_id
      OR NEW.cpf IS DISTINCT FROM OLD.cpf
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.convidado_por IS DISTINCT FROM OLD.convidado_por THEN
      RAISE EXCEPTION 'Dados de identidade e grupo não podem ser alterados diretamente';
    END IF;
    IF NEW.ativo IS DISTINCT FROM OLD.ativo AND NOT private.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Somente a administração do site pode alterar o status da conta';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_identidade_perfil ON public.profiles;
CREATE TRIGGER proteger_identidade_perfil
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.proteger_identidade_perfil();

-- Os buckets são privados, mas as antigas policies aceitavam qualquer
-- usuário autenticado. O caminho da fatura contém o ID do lote; o caminho
-- do orçamento contém o ID do veículo. Ambos são resolvidos no mesmo grupo.
DROP POLICY IF EXISTS faturas_membro_ativo ON storage.objects;
DROP POLICY IF EXISTS faturas_por_grupo ON storage.objects;
CREATE POLICY faturas_por_grupo ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'faturas'
  AND EXISTS (
    SELECT 1 FROM public.import_lotes AS lote
    WHERE lote.id::text = split_part(name, '/', 1)
      AND lote.grupo_id = private.meu_grupo_id()
  )
)
WITH CHECK (
  bucket_id = 'faturas'
  AND EXISTS (
    SELECT 1 FROM public.import_lotes AS lote
    WHERE lote.id::text = split_part(name, '/', 1)
      AND lote.grupo_id = private.meu_grupo_id()
  )
);

DROP POLICY IF EXISTS anexos_household_all ON storage.objects;
DROP POLICY IF EXISTS anexos_veiculos_por_grupo ON storage.objects;
CREATE POLICY anexos_veiculos_por_grupo ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'anexos'
  AND split_part(name, '/', 1) = 'veiculos'
  AND EXISTS (
    SELECT 1 FROM public.veiculos AS veiculo
    WHERE veiculo.id::text = split_part(name, '/', 2)
      AND veiculo.grupo_id = private.meu_grupo_id()
  )
)
WITH CHECK (
  bucket_id = 'anexos'
  AND split_part(name, '/', 1) = 'veiculos'
  AND EXISTS (
    SELECT 1 FROM public.veiculos AS veiculo
    WHERE veiculo.id::text = split_part(name, '/', 2)
      AND veiculo.grupo_id = private.meu_grupo_id()
  )
);

COMMIT;
