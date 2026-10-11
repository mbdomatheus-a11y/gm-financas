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
