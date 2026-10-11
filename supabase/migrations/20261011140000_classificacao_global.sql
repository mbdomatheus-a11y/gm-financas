-- Aprendizado global de classificação (2026-10-11).
-- Cada grupo (família) dá UM voto por estabelecimento: a categoria mãe com que
-- classificou o gasto. Só categorias padrão do sistema (criadas pelo admin)
-- contam; categorias personalizadas do usuário nunca viram regra global.
-- A sugestão é a categoria com mais grupos votando nela.
-- O voto guarda o grupo só internamente; nenhuma função devolve quem votou.

CREATE TABLE IF NOT EXISTS public.classificacao_voto (
  chave text NOT NULL,
  grupo_id uuid NOT NULL,
  categoria text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chave, grupo_id)
);

ALTER TABLE public.classificacao_voto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.classificacao_voto FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_votos_classificacao(p_votos jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
  g uuid;
  k text;
  c text;
  n integer := 0;
BEGIN
  SELECT grupo_id INTO g FROM public.profiles WHERE id = auth.uid();
  IF g IS NULL THEN
    RAISE EXCEPTION 'Sem grupo para registrar classificação.';
  END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_votos, '[]'::jsonb)) LOOP
    k := v->>'chave';
    c := v->>'categoria';
    IF k IS NULL OR k = '' OR c IS NULL OR c = '' THEN CONTINUE; END IF;
    -- Transferências e pagamentos a pessoas nunca viram regra global.
    IF k ~* '\m(PIX|TED|DOC|TRANSF|TRANSFERENCIA|SAQUE|BOLETO)\M' THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categorias_padrao cp WHERE cp.nome = c AND cp.ativo) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.classificacao_voto (chave, grupo_id, categoria, atualizado_em)
    VALUES (k, g, c, now())
    ON CONFLICT (chave, grupo_id)
    DO UPDATE SET categoria = EXCLUDED.categoria, atualizado_em = now();
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.sugerir_classificacao(p_chaves text[])
RETURNS TABLE (chave text, categoria text, votos bigint, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH contagem AS (
    SELECT v.chave, v.categoria, count(*) AS votos, max(v.atualizado_em) AS ultimo
    FROM public.classificacao_voto v
    JOIN public.categorias_padrao cp ON cp.nome = v.categoria AND cp.ativo
    WHERE v.chave = ANY (p_chaves)
    GROUP BY v.chave, v.categoria
  ),
  ranking AS (
    SELECT c.*,
      sum(c.votos) OVER (PARTITION BY c.chave) AS total,
      row_number() OVER (PARTITION BY c.chave ORDER BY c.votos DESC, c.ultimo DESC) AS posicao
    FROM contagem c
  )
  SELECT r.chave, r.categoria, r.votos, r.total FROM ranking r WHERE r.posicao = 1;
$$;

REVOKE ALL ON FUNCTION public.registrar_votos_classificacao(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.sugerir_classificacao(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_votos_classificacao(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sugerir_classificacao(text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
