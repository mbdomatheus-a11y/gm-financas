-- Expansão da administração: novos status de privacidade, chamados de suporte, convites admin
BEGIN;

-- 1. Expandir status da tabela solicitacoes_privacidade
ALTER TABLE public.solicitacoes_privacidade
  DROP CONSTRAINT IF EXISTS solicitacoes_privacidade_status_check;

ALTER TABLE public.solicitacoes_privacidade
  ADD CONSTRAINT solicitacoes_privacidade_status_check
    CHECK (status IN ('recebida','em_analise','concluida','indeferida','em_atendimento','aguardando_ti','planejado','programado'));

-- 2. Adicionar coluna tratativa_historico (array de mensagens do admin) se não existir
ALTER TABLE public.solicitacoes_privacidade
  ADD COLUMN IF NOT EXISTS tratativa_historico jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Criar tabela de chamados de suporte
CREATE TABLE IF NOT EXISTS public.chamados_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  email text NOT NULL,
  nome text,
  assunto text NOT NULL,
  descricao text NOT NULL,
  status text NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido','em_atendimento','aguardando_usuario','resolvido','cancelado')),
  prioridade text NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  resposta_admin text,
  tratado_por uuid REFERENCES auth.users(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY chamados_proprios ON public.chamados_suporte
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY chamados_insert ON public.chamados_suporte
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT ON public.chamados_suporte TO authenticated;
GRANT ALL ON public.chamados_suporte TO service_role;

-- 4. Convites: adicionar contagem/status no admin (a tabela já existe, apenas garantir campos)
ALTER TABLE public.convites
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false;

-- 5. Adicionar coluna email para layout_solicitacoes (para notificar)
ALTER TABLE public.layout_solicitacoes
  ADD COLUMN IF NOT EXISTS email_usuario text;

-- 6. Adicionar campo perfil para dados de login/cadastro editáveis
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS data_nascimento date;

-- Idempotente: se já existem, ignora
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN telefone text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN data_nascimento date;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
