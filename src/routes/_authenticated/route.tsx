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
import { AvisoBetaApp } from "@/components/BetaTestFlight";
import { AtualizacaoSite } from "@/components/AtualizacaoSite";
import { TourGuiado } from "@/components/TourGuiado";
import { IdiomaProvider } from "@/hooks/useIdioma";
import { ExclusaoAgendadaModal } from "@/components/ExclusaoAgendadaModal";
import { BoasVindasExemplos } from "@/components/BoasVindasExemplos";
import { PrimeirosPassos } from "@/components/retencao/PrimeirosPassos";
import { useUltimaTela } from "@/lib/ultima-tela";
import { useModulosGlobais, useSession, type ModuloGlobal } from "@/hooks/useAuthData";
import { useAplicarRedefinicaoAvisos } from "@/lib/redefinir-avisos";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/entrar", search: { next: `${location.pathname}${location.searchStr ?? ""}` } });

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
  "/caixinhas": "financas",
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
  "/links": "links",
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
  // Plano de retenção (2026-10-17): conta nova faz o 1º lançamento antes do tour.
  const [exemplosAberto, setExemplosAberto] = useState(false);
  const [primeirosPassos, setPrimeirosPassos] = useState(false);
  const [betaAberto, setBetaAberto] = useState(false);
  const { user } = useSession();
  // Admin pode redefinir os avisos (para gravar vídeos): limpa o "já vi" guardado neste navegador.
  useAplicarRedefinicaoAvisos(user?.id);
  // 31/10/2026: reabre na última tela em que a pessoa estava (igual ao app).
  useUltimaTela(user?.id);
  useEffect(() => {
    const modulo = MODULO_POR_ROTA[pathname];
    if (!isLoading && modulo && !habilitado(modulo))
      void navigate({ to: "/inicio", replace: true });
  }, [pathname, isLoading, habilitado, navigate]);
  return (
    <InactivityGuard>
      <IdiomaProvider>
      <AtualizacaoSite />
      <ExclusaoAgendadaModal />
      <ComunicadosModal onVisibilityChange={setAvisoAberto} />
      <BoasVindasExemplos bloqueado={avisoAberto} onVisibilityChange={setExemplosAberto} />
      <PrimeirosPassos bloqueado={avisoAberto || exemplosAberto} onPendenteChange={setPrimeirosPassos} />
      <TourGuiado bloqueado={avisoAberto || exemplosAberto || primeirosPassos} />
      <AvisoBetaApp bloqueado={avisoAberto || exemplosAberto} onVisibilityChange={setBetaAberto} />
      <ConviteAposTresDias bloqueado={avisoAberto || betaAberto} />
      <Outlet />
      </IdiomaProvider>
    </InactivityGuard>
  );
}
