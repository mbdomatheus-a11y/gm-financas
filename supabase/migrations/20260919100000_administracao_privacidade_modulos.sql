-- Administração, privacidade e os novos módulos pessoais.
-- Arquivos são enviados exclusivamente por funções de servidor com service role;
-- os buckets ficam privados e não recebem policy pública.
BEGIN;

ALTER TABLE public.lista_compras
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.login_tentativas (
  identificador_hash text PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0 CHECK (falhas >= 0),
  bloqueado_ate timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.login_tentativas ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.login_tentativas TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_tentativa_login(p_hash text, p_sucesso boolean)
RETURNS TABLE (bloqueado_ate timestamptz, falhas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_falhas integer; v_bloqueio timestamptz;
BEGIN
  IF p_sucesso THEN
    DELETE FROM public.login_tentativas WHERE identificador_hash = p_hash;
    RETURN QUERY SELECT NULL::timestamptz, 0;
    RETURN;
  END IF;
  INSERT INTO public.login_tentativas AS l (identificador_hash, falhas, atualizado_em)
  VALUES (p_hash, 1, now())
  ON CONFLICT (identificador_hash) DO UPDATE
    SET falhas = CASE WHEN l.bloqueado_ate IS NOT NULL AND l.bloqueado_ate <= now() THEN 1 ELSE l.falhas + 1 END,
        bloqueado_ate = CASE WHEN l.bloqueado_ate IS NOT NULL AND l.bloqueado_ate > now() THEN l.bloqueado_ate
          WHEN (CASE WHEN l.bloqueado_ate IS NOT NULL AND l.bloqueado_ate <= now() THEN 1 ELSE l.falhas + 1 END) >= 3
            THEN now() + interval '15 minutes' ELSE NULL END,
        atualizado_em = now()
  RETURNING l.falhas, l.bloqueado_ate INTO v_falhas, v_bloqueio;
  RETURN QUERY SELECT v_bloqueio, v_falhas;
END; $$;
REVOKE ALL ON FUNCTION public.registrar_tentativa_login(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_tentativa_login(text, boolean) TO service_role;

CREATE TABLE IF NOT EXISTS public.aceites_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  documento text NOT NULL CHECK (documento IN ('termos_uso', 'aviso_privacidade')),
  versao text NOT NULL, aceito_em timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, documento, versao)
);
ALTER TABLE public.aceites_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY aceites_proprios ON public.aceites_documentos FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.aceites_documentos TO authenticated;
GRANT ALL ON public.aceites_documentos TO service_role;

CREATE TABLE IF NOT EXISTS public.solicitacoes_privacidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), protocolo uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, email text NOT NULL, telefone text NOT NULL,
  cpf_hash text NOT NULL, tipo text NOT NULL DEFAULT 'exclusao', motivo text, status text NOT NULL DEFAULT 'recebida'
    CHECK (status IN ('recebida','em_analise','concluida','indeferida')),
  resposta_admin text, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(), tratado_por uuid REFERENCES auth.users(id)
);
ALTER TABLE public.solicitacoes_privacidade ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.solicitacoes_privacidade TO service_role;

CREATE TABLE IF NOT EXISTS public.layout_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL, banco_informado text, cartao_final text,
  arquivo_nome text NOT NULL, arquivo_path text NOT NULL, descricao text, status text NOT NULL DEFAULT 'recebida'
    CHECK (status IN ('recebida','em_modelagem','corrigida','descartada')),
  consentimento_em timestamptz NOT NULL DEFAULT now(), prazo_exclusao timestamptz NOT NULL DEFAULT now() + interval '30 days',
  resposta_admin text, layout_id text, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(), tratado_por uuid REFERENCES auth.users(id)
);
ALTER TABLE public.layout_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY layout_solicitacao_propria ON public.layout_solicitacoes FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.layout_solicitacoes TO authenticated;
GRANT ALL ON public.layout_solicitacoes TO service_role;

CREATE TABLE IF NOT EXISTS public.notificacoes_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL, titulo text NOT NULL, mensagem text NOT NULL, referencia_tipo text, referencia_id uuid,
  lida_em timestamptz, criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notificacoes_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificacoes_proprias ON public.notificacoes_usuario FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, UPDATE ON public.notificacoes_usuario TO authenticated;
GRANT ALL ON public.notificacoes_usuario TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL, alvo_id uuid, detalhes jsonb NOT NULL DEFAULT '{}'::jsonb, criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.admin_audit_logs TO service_role;

CREATE TABLE IF NOT EXISTS public.comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL, mensagem text NOT NULL, exige_aceite boolean NOT NULL DEFAULT true, ativo boolean NOT NULL DEFAULT true,
  publicado_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz, criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.comunicado_aceites (
  comunicado_id uuid NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aceito_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(comunicado_id, user_id)
);
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicado_aceites ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.comunicados, public.comunicado_aceites TO service_role;

CREATE TABLE IF NOT EXISTS public.eventos_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iniciou_em timestamptz NOT NULL DEFAULT now(), ultima_atividade_em timestamptz NOT NULL DEFAULT now(), encerrou_em timestamptz,
  motivo_encerramento text
);
ALTER TABLE public.eventos_sessao ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.eventos_sessao TO service_role;

CREATE TABLE IF NOT EXISTS public.pet_animais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  nome text NOT NULL, especie text NOT NULL DEFAULT 'outro', raca text, nascimento date, observacao text, foto_path text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pet_vacinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pet_id uuid NOT NULL REFERENCES public.pet_animais(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE, nome text NOT NULL, aplicada_em date, proxima_dose_em date, observacao text, comprovante_path text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pet_animais ENABLE ROW LEVEL SECURITY; ALTER TABLE public.pet_vacinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY pet_animais_grupo ON public.pet_animais FOR ALL TO authenticated USING (grupo_id = private.meu_grupo_id()) WITH CHECK (grupo_id = private.meu_grupo_id());
CREATE POLICY pet_vacinas_grupo ON public.pet_vacinas FOR ALL TO authenticated USING (grupo_id = private.meu_grupo_id()) WITH CHECK (grupo_id = private.meu_grupo_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_animais, public.pet_vacinas TO authenticated; GRANT ALL ON public.pet_animais, public.pet_vacinas TO service_role;

CREATE TABLE IF NOT EXISTS public.locais_armazenamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  local_pai_id uuid REFERENCES public.locais_armazenamento(id) ON DELETE SET NULL, nome text NOT NULL, descricao text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.itens_armazenados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  local_id uuid NOT NULL REFERENCES public.locais_armazenamento(id) ON DELETE CASCADE, nome text NOT NULL, quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade >= 0), observacao text, foto_path text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.locais_armazenamento ENABLE ROW LEVEL SECURITY; ALTER TABLE public.itens_armazenados ENABLE ROW LEVEL SECURITY;
CREATE POLICY locais_grupo ON public.locais_armazenamento FOR ALL TO authenticated USING (grupo_id = private.meu_grupo_id()) WITH CHECK (grupo_id = private.meu_grupo_id());
CREATE POLICY itens_armazenados_grupo ON public.itens_armazenados FOR ALL TO authenticated USING (grupo_id = private.meu_grupo_id()) WITH CHECK (grupo_id = private.meu_grupo_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais_armazenamento, public.itens_armazenados TO authenticated; GRANT ALL ON public.locais_armazenamento, public.itens_armazenados TO service_role;

CREATE TABLE IF NOT EXISTS public.exames_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL, titulo text NOT NULL, tipo text, data_exame date, observacao text,
  arquivo_path text, compartilhado_grupo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.exame_medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exame_id uuid NOT NULL REFERENCES public.exames_registros(id) ON DELETE CASCADE,
  indicador text NOT NULL, valor numeric, unidade text, data_medicao date NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exames_registros ENABLE ROW LEVEL SECURITY; ALTER TABLE public.exame_medicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY exames_privados_ou_compartilhados ON public.exames_registros FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (compartilhado_grupo AND grupo_id = private.meu_grupo_id()))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY medicoes_exames_acessiveis ON public.exame_medicoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exames_registros e WHERE e.id = exame_id AND (e.user_id = auth.uid() OR (e.compartilhado_grupo AND e.grupo_id = private.meu_grupo_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exames_registros e WHERE e.id = exame_id AND e.user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exames_registros, public.exame_medicoes TO authenticated; GRANT ALL ON public.exames_registros, public.exame_medicoes TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('layouts_analise','layouts_analise',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('inventario','inventario',false,10485760,ARRAY['image/jpeg','image/png','image/webp']),
  ('exames','exames',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';
COMMIT;
