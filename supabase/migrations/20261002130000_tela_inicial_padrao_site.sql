ALTER TABLE public.configuracoes_acesso_site
  ADD COLUMN IF NOT EXISTS tela_inicial_padrao text NOT NULL DEFAULT 'financas'
    CHECK (tela_inicial_padrao IN ('financas', 'lista-compras', 'notas'));

NOTIFY pgrst, 'reload schema';
