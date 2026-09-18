CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION private.is_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ativo) $$;

REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_active_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_active_member() TO authenticated, service_role;

-- profiles
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY profiles_admin_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY profiles_update_self_or_admin ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY profiles_admin_delete ON public.profiles FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

-- permissoes
DROP POLICY IF EXISTS permissoes_select ON public.permissoes;
DROP POLICY IF EXISTS permissoes_admin_all ON public.permissoes;
CREATE POLICY permissoes_select ON public.permissoes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY permissoes_admin_all ON public.permissoes FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS roles_select ON public.user_roles;
CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

-- financial tables: shared between household members, but only active ones
DROP POLICY IF EXISTS bancos_all ON public.bancos;
CREATE POLICY bancos_all ON public.bancos FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
DROP POLICY IF EXISTS cartoes_all ON public.cartoes;
CREATE POLICY cartoes_all ON public.cartoes FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
DROP POLICY IF EXISTS categorias_all ON public.categorias;
CREATE POLICY categorias_all ON public.categorias FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
DROP POLICY IF EXISTS despesas_all ON public.despesas;
CREATE POLICY despesas_all ON public.despesas FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
DROP POLICY IF EXISTS parcelas_all ON public.parcelas;
CREATE POLICY parcelas_all ON public.parcelas FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
DROP POLICY IF EXISTS receitas_all ON public.receitas;
CREATE POLICY receitas_all ON public.receitas FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
DROP POLICY IF EXISTS investimentos_all ON public.investimentos;
CREATE POLICY investimentos_all ON public.investimentos FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());
DROP POLICY IF EXISTS invmov_all ON public.investimento_movimentos;
CREATE POLICY invmov_all ON public.investimento_movimentos FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());

-- remove the publicly executable SECURITY DEFINER function
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);