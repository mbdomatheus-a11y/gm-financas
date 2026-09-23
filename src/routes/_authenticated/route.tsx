import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InactivityGuard } from "@/components/InactivityGuard";
import { ComunicadosModal } from "@/components/ComunicadosModal";
import { useModulosGlobais, type ModuloGlobal } from "@/hooks/useAuthData";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/entrar" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("senha_temporaria,ativo")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.ativo) {
      await supabase.auth.signOut();
      throw redirect({ to: "/entrar" });
    }
    if (profile.senha_temporaria && location.pathname !== "/nova-senha") {
      throw redirect({ to: "/nova-senha" });
    }
    return { user: data.user };
  },
  component: Protegido,
});

const MODULO_POR_ROTA: Record<string, ModuloGlobal> = {
  "/dashboard": "financas",
  "/receitas": "financas",
  "/despesas": "financas",
  "/importar": "financas",
  "/categorias": "financas",
  "/de-para": "financas",
  "/cartoes": "financas",
  "/investimentos": "financas",
  "/lista-compras": "lista",
  "/notas": "notas",
  "/ferramentas": "calculadora",
  "/pets": "pet",
  "/onde-esta": "onde_esta",
  "/veiculos": "veiculo",
  "/exames": "exames",
};
function Protegido() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { habilitado, isLoading } = useModulosGlobais();
  useEffect(() => {
    const modulo = MODULO_POR_ROTA[pathname];
    if (!isLoading && modulo && !habilitado(modulo))
      void navigate({ to: "/inicio", replace: true });
  }, [pathname, isLoading, habilitado, navigate]);
  return (
    <InactivityGuard>
      <ComunicadosModal />
      <Outlet />
    </InactivityGuard>
  );
}
