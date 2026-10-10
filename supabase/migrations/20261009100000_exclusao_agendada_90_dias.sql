-- Exclusão de conta agendada pelo admin: 90 dias de carência.
-- Durante a carência a conta continua acessível, mas o usuário vê aviso com
-- o tempo restante e decide se cancela a exclusão. Escrita só pelo servidor
-- (service_role); o usuário apenas lê a própria linha.
-- Sem FK para auth.users de propósito (criar a FK travou no banco); a linha é
-- removida pelo servidor ao cancelar ou ao concluir a exclusão.
CREATE TABLE IF NOT EXISTS public.exclusoes_agendadas (
  user_id uuid PRIMARY KEY,
  agendada_em timestamptz NOT NULL DEFAULT now(),
  prevista_em timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  agendada_por uuid
);
ALTER TABLE public.exclusoes_agendadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY exclusoes_agendadas_select_proprio ON public.exclusoes_agendadas
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.exclusoes_agendadas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.exclusoes_agendadas FROM authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.exclusoes_agendadas FROM authenticated;
-- Anotações (links_admin): marcar como analisada sem apagar.
ALTER TABLE public.links_admin ADD COLUMN IF NOT EXISTS concluida_em timestamptz;
-- Início em widgets: ordem e tamanho escolhidos pelo usuário (null = automático).
ALTER TABLE public.preferencias_usuario ADD COLUMN IF NOT EXISTS home_widgets jsonb;
