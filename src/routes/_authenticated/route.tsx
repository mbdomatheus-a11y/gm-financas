import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InactivityGuard } from "@/components/InactivityGuard";
import { ComunicadosModal } from "@/components/ComunicadosModal";
import { ConviteAposTresDias } from "@/components/ConviteAmigosBanner";
import { TourGuiado } from "@/components/TourGuiado";
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
  // Enquanto o aviso de boas-vindas estiver na tela (modal bloqueante), o
  // tour guiado espera — evita os dois disputando a tela ao mesmo tempo.
  // Começa travado (true) por padrão: só libera quando o ComunicadosModal
  // confirmar que já sabe se há ou não aviso pendente (ver comentário em
  // ComunicadosModal.tsx sobre a condição de corrida que isso evita).
  const [avisoAberto, setAvisoAberto] = useState(true);
  useEffect(() => {
    const modulo = MODULO_POR_ROTA[pathname];
    if (!isLoading && modulo && !habilitado(modulo))
      void navigate({ to: "/inicio", replace: true });
  }, [pathname, isLoading, habilitado, navigate]);
  return (
    <InactivityGuard>
      <ComunicadosModal onVisibilityChange={setAvisoAberto} />
      <TourGuiado bloqueado={avisoAberto} />
      <ConviteAposTresDias bloqueado={avisoAberto} />
      <Outlet />
    </InactivityGuard>
  );
}
