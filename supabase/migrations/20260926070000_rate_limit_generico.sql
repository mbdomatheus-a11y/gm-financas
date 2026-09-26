-- Item 15 do backlog do proprietário: revisão de segurança. Tabela genérica
-- de limite de tentativas por IP/e-mail, reaproveitável por qualquer rota
-- pública (server function sem autenticação) — evita duplicar a mesma
-- lógica de "contar linhas numa janela de tempo" em cada endpoint.
-- Guarda só um hash da chave (IP ou e-mail, nunca em texto puro) e o nome
-- da rota — nunca dados de conteúdo da requisição.
CREATE TABLE IF NOT EXISTS public.rate_limit_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota text NOT NULL,
  chave_hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_limit_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_eventos FROM anon, authenticated;
GRANT ALL ON public.rate_limit_eventos TO service_role;
CREATE INDEX IF NOT EXISTS idx_rate_limit_eventos_consulta
  ON public.rate_limit_eventos(rota, chave_hash, criado_em);

NOTIFY pgrst, 'reload schema';
