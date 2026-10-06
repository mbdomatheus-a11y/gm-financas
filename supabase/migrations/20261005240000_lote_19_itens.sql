-- Lote de 19 itens (2026-10-05). Todas as mudanças são aditivas.
-- Já aplicadas em produção via execute_sql (uma instrução por vez).

-- Item 5: log detalhado de falhas de login (acesso só pelo service role).
CREATE TABLE IF NOT EXISTS public.login_falhas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  identificador text,
  tipo_identificador text,
  motivo text NOT NULL,
  ip text,
  cidade text,
  regiao text,
  pais text,
  user_agent text,
  user_id uuid,
  tentativas integer,
  bloqueou boolean
);
ALTER TABLE public.login_falhas_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS login_falhas_log_criado_em_idx ON public.login_falhas_log (criado_em DESC);

-- Item 17: admin liga/desliga o aviso da calculadora.
ALTER TABLE public.configuracoes_acesso_site
  ADD COLUMN IF NOT EXISTS exibir_aviso_calculadora boolean NOT NULL DEFAULT true;

-- Item 19: cartão ou conta usada na compra da nota.
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS pagamento_tipo text,
  ADD COLUMN IF NOT EXISTS pagamento_id uuid;

-- Item 12: usuário clicou em "não responder" no perfil financeiro.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS perfil_financeiro_pulado_em timestamptz;
