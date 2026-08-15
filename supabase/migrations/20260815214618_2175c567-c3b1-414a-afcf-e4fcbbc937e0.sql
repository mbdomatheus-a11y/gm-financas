CREATE TYPE public.app_role AS ENUM ('admin','comum');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text NOT NULL UNIQUE,
  senha_temporaria boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  pode_ver boolean NOT NULL DEFAULT true,
  pode_editar boolean NOT NULL DEFAULT true,
  pode_excluir boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, modulo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes TO authenticated;
GRANT ALL ON public.permissoes TO service_role;
ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissoes_select" ON public.permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissoes_admin_all" ON public.permissoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  icone text,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_all" ON public.categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.bancos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  agencia text,
  conta text,
  tipo_conta text NOT NULL DEFAULT 'corrente',
  titular text,
  saldo_atual numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bancos TO authenticated;
GRANT ALL ON public.bancos TO service_role;
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bancos_all" ON public.bancos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cartoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular text NOT NULL,
  final text NOT NULL,
  bandeira text NOT NULL DEFAULT 'Visa',
  tipo text NOT NULL DEFAULT 'credito',
  validade_mes int,
  validade_ano int,
  dia_fechamento int,
  dia_vencimento int,
  limite numeric(14,2),
  banco_id uuid REFERENCES public.bancos(id) ON DELETE SET NULL,
  apelido text,
  cor text DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes TO authenticated;
GRANT ALL ON public.cartoes TO service_role;
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cartoes_all" ON public.cartoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  moeda text NOT NULL DEFAULT 'BRL',
  categoria text NOT NULL DEFAULT 'outros',
  data_recebimento date NOT NULL,
  recorrente boolean NOT NULL DEFAULT false,
  frequencia text,
  responsavel text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receitas TO authenticated;
GRANT ALL ON public.receitas TO service_role;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receitas_all" ON public.receitas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor_total numeric(14,2) NOT NULL CHECK (valor_total > 0),
  moeda text NOT NULL DEFAULT 'BRL',
  categoria text NOT NULL DEFAULT 'outros',
  tipo text NOT NULL CHECK (tipo IN ('fixa','variavel')),
  data_compra date NOT NULL,
  cartao_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL,
  banco_id uuid REFERENCES public.bancos(id) ON DELETE SET NULL,
  total_parcelas int NOT NULL DEFAULT 1 CHECK (total_parcelas >= 1),
  data_primeira_parcela date NOT NULL,
  responsavel text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_all" ON public.despesas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id uuid NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  numero int NOT NULL,
  total int NOT NULL,
  valor numeric(14,2) NOT NULL,
  moeda text NOT NULL DEFAULT 'BRL',
  vencimento date NOT NULL,
  paga boolean NOT NULL DEFAULT false,
  data_pagamento date
);
CREATE INDEX idx_parcelas_venc ON public.parcelas(vencimento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcelas TO authenticated;
GRANT ALL ON public.parcelas TO service_role;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcelas_all" ON public.parcelas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.investimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL,
  valor_investido numeric(14,2) NOT NULL DEFAULT 0,
  valor_atual numeric(14,2) NOT NULL DEFAULT 0,
  data_investimento date NOT NULL,
  instituicao text,
  rentabilidade text,
  responsavel text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investimentos TO authenticated;
GRANT ALL ON public.investimentos TO service_role;
ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investimentos_all" ON public.investimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.investimento_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investimento_id uuid NOT NULL REFERENCES public.investimentos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('aporte','resgate')),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investimento_movimentos TO authenticated;
GRANT ALL ON public.investimento_movimentos TO service_role;
ALTER TABLE public.investimento_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invmov_all" ON public.investimento_movimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.preferencias_usuario (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tema text NOT NULL DEFAULT 'claro',
  paleta text NOT NULL DEFAULT 'azul',
  fonte text NOT NULL DEFAULT 'Inter',
  layout_menu text NOT NULL DEFAULT 'lateral',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias_usuario TO authenticated;
GRANT ALL ON public.preferencias_usuario TO service_role;
ALTER TABLE public.preferencias_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_own" ON public.preferencias_usuario FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.categorias (nome, tipo) VALUES
 ('Salário','receita'),('Freelance','receita'),('Rendimento','receita'),('Outros','receita'),
 ('Moradia','despesa'),('Alimentação','despesa'),('Transporte','despesa'),('Lazer','despesa'),
 ('Cartão de Crédito','despesa'),('Saúde','despesa'),('Educação','despesa'),('Outros','despesa');