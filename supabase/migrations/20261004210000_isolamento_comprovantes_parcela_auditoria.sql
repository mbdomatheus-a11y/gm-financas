-- Isola comprovantes e parcela_auditoria por grupo.
-- Antes: policy "membro_ativo" exigia apenas meu_grupo_id() IS NOT NULL, ou seja,
-- qualquer usuario logado lia e escrevia os registros de TODOS os grupos.

CREATE POLICY comprovantes_grupo ON public.comprovantes FOR ALL TO authenticated
USING (created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = comprovantes.created_by AND p.grupo_id = private.meu_grupo_id())
  OR EXISTS (SELECT 1 FROM public.despesas d WHERE d.id = comprovantes.despesa_id AND d.grupo_id = private.meu_grupo_id())
  OR EXISTS (SELECT 1 FROM public.receitas r WHERE r.id = comprovantes.receita_id AND r.grupo_id = private.meu_grupo_id())
  OR EXISTS (SELECT 1 FROM public.import_lotes l WHERE l.id = comprovantes.lote_id AND l.grupo_id = private.meu_grupo_id()))
WITH CHECK (created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.despesas d WHERE d.id = comprovantes.despesa_id AND d.grupo_id = private.meu_grupo_id())
  OR EXISTS (SELECT 1 FROM public.receitas r WHERE r.id = comprovantes.receita_id AND r.grupo_id = private.meu_grupo_id())
  OR EXISTS (SELECT 1 FROM public.import_lotes l WHERE l.id = comprovantes.lote_id AND l.grupo_id = private.meu_grupo_id()));
DROP POLICY IF EXISTS comprovantes_membro_ativo ON public.comprovantes;

CREATE POLICY parcela_auditoria_grupo ON public.parcela_auditoria FOR ALL TO authenticated
USING (alterado_por = auth.uid()
  OR EXISTS (SELECT 1 FROM public.parcelas pa WHERE pa.id = parcela_auditoria.parcela_id AND pa.grupo_id = private.meu_grupo_id())
  OR EXISTS (SELECT 1 FROM public.despesas d WHERE d.id = parcela_auditoria.despesa_id AND d.grupo_id = private.meu_grupo_id()))
WITH CHECK (alterado_por = auth.uid()
  OR EXISTS (SELECT 1 FROM public.parcelas pa WHERE pa.id = parcela_auditoria.parcela_id AND pa.grupo_id = private.meu_grupo_id())
  OR EXISTS (SELECT 1 FROM public.despesas d WHERE d.id = parcela_auditoria.despesa_id AND d.grupo_id = private.meu_grupo_id()));
DROP POLICY IF EXISTS parcela_auditoria_membro_ativo ON public.parcela_auditoria;
