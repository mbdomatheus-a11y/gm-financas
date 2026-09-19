BEGIN;

CREATE TABLE IF NOT EXISTS public.configuracoes_site (
  chave text PRIMARY KEY,
  valor_inteiro integer NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configuracoes_site_valor_positivo CHECK (valor_inteiro BETWEEN 2 AND 120)
);

ALTER TABLE public.configuracoes_site ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS configuracoes_site_leitura ON public.configuracoes_site;
CREATE POLICY configuracoes_site_leitura ON public.configuracoes_site
FOR SELECT TO authenticated USING (true);

INSERT INTO public.configuracoes_site (chave, valor_inteiro)
VALUES ('inatividade_minutos', 5)
ON CONFLICT (chave) DO NOTHING;

GRANT SELECT ON public.configuracoes_site TO authenticated;
GRANT ALL ON public.configuracoes_site TO service_role;

COMMIT;
