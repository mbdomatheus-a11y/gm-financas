-- Metricas de desempenho (web e apps). Retencao de 30 dias.
CREATE TABLE IF NOT EXISTS public.desempenho_metricas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  plataforma text NOT NULL CHECK (plataforma IN ('web','ios','android')),
  tela text NOT NULL,
  metrica text NOT NULL CHECK (metrica IN ('LCP','INP','CLS','TTFB','FCP','carregamento','erro')),
  valor numeric NOT NULL DEFAULT 0,
  versao text,
  conexao text
);

CREATE INDEX IF NOT EXISTS desempenho_metricas_created_idx ON public.desempenho_metricas (created_at DESC);
CREATE INDEX IF NOT EXISTS desempenho_metricas_agrupa_idx ON public.desempenho_metricas (plataforma, tela, metrica, created_at);

ALTER TABLE public.desempenho_metricas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS desempenho_insert ON public.desempenho_metricas;
CREATE POLICY desempenho_insert ON public.desempenho_metricas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS desempenho_select_admin ON public.desempenho_metricas;
CREATE POLICY desempenho_select_admin ON public.desempenho_metricas
  FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));

GRANT INSERT, SELECT ON public.desempenho_metricas TO authenticated;
GRANT ALL ON public.desempenho_metricas TO service_role;

-- Retencao: apaga registros com mais de 30 dias. Chamada por resumo_desempenho (sem cron novo).
CREATE OR REPLACE FUNCTION public.limpar_desempenho_antigo()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.desempenho_metricas WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.limpar_desempenho_antigo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_desempenho_antigo() TO service_role;

CREATE OR REPLACE FUNCTION public.resumo_desempenho(dias int DEFAULT 7)
RETURNS TABLE (plataforma text, tela text, metrica text, amostras bigint, p50 numeric, p75 numeric, p95 numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.plataforma, m.tela, m.metrica, count(*)::bigint,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY m.valor))::numeric,
    (percentile_cont(0.75) WITHIN GROUP (ORDER BY m.valor))::numeric,
    (percentile_cont(0.95) WITHIN GROUP (ORDER BY m.valor))::numeric
  FROM public.desempenho_metricas m
  WHERE m.created_at >= now() - make_interval(days => LEAST(GREATEST(dias, 1), 30))
  GROUP BY m.plataforma, m.tela, m.metrica;
END $$;
REVOKE ALL ON FUNCTION public.resumo_desempenho(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_desempenho(int) TO authenticated, service_role;

-- Retencao sem cron: a limpeza roda quando o admin abre o relatorio (funcao dedicada, so admin).
CREATE OR REPLACE FUNCTION public.limpar_desempenho_admin()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN public.limpar_desempenho_antigo();
END $$;
REVOKE ALL ON FUNCTION public.limpar_desempenho_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_desempenho_admin() TO authenticated, service_role;
