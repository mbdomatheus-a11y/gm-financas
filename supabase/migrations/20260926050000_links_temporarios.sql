-- Item 6 do backlog do proprietário: links de mensagem temporária,
-- públicos (sem login), com expiração por número de aberturas (1 a 3) ou
-- 7 dias, o que vier primeiro. Criptografia (quando o remetente escolhe
-- senha) é feita no navegador — o servidor só guarda texto cifrado, salt
-- e IV nesse caso, nunca a senha. Acesso é exclusivamente via service_role
-- (pelas server functions em links-temporarios.functions.ts); anon e
-- authenticated não têm acesso direto às tabelas.

CREATE TABLE IF NOT EXISTS public.links_temporarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo text NOT NULL,
  criptografado boolean NOT NULL DEFAULT false,
  salt text,
  iv text,
  aberturas_max smallint NOT NULL DEFAULT 1 CHECK (aberturas_max BETWEEN 1 AND 3),
  aberturas_usadas smallint NOT NULL DEFAULT 0 CHECK (aberturas_usadas >= 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  criador_ip_hash text
);
ALTER TABLE public.links_temporarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.links_temporarios FROM anon, authenticated;
GRANT ALL ON public.links_temporarios TO service_role;

-- Auditoria: nunca guarda o conteúdo da mensagem, só o evento. Sobrevive à
-- exclusão definitiva do link (por isso não tem FK para links_temporarios).
CREATE TABLE IF NOT EXISTS public.links_temporarios_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL,
  evento text NOT NULL CHECK (evento IN ('criado', 'aberto', 'esgotado', 'expirado_por_tempo', 'nao_encontrado')),
  ip_hash text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.links_temporarios_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.links_temporarios_auditoria FROM anon, authenticated;
GRANT ALL ON public.links_temporarios_auditoria TO service_role;
CREATE INDEX IF NOT EXISTS idx_links_temp_auditoria_link_id ON public.links_temporarios_auditoria(link_id);
CREATE INDEX IF NOT EXISTS idx_links_temp_auditoria_ip_evento_data
  ON public.links_temporarios_auditoria(ip_hash, evento, criado_em);

NOTIFY pgrst, 'reload schema';
