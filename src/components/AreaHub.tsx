import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useModulosGlobais, usePermissoes } from "@/hooks/useAuthData";
import { ADMIN_ONLY_CARD, ADMIN_ONLY_TAG, AREAS, MODULOS_INFO, type AreaId } from "@/lib/areas";
import { cn } from "@/lib/utils";

/** Tela de uma área: só os módulos dela, em cartões grandes e simples. */
export function AreaHub({ area }: { area: AreaId }) {
  const info = AREAS[area];
  const { habilitado, liberadoGeral } = useModulosGlobais();
  const { isSiteAdmin } = usePermissoes();
  const modulos = info.modulos.filter((m) => habilitado(m));
  return (
    <AppLayout title={info.titulo} description={info.descricao}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modulos.map((m) => {
          const mod = MODULOS_INFO[m];
          const Icon = mod.icon;
          const soAdmin = isSiteAdmin && !liberadoGeral(m);
          return (
            <Link key={m} to={mod.to}>
              <Card className={cn("lift h-full", soAdmin && ADMIN_ONLY_CARD)}>
                <CardContent className="flex h-full min-h-32 items-center gap-4 p-5">
                  <div className="gradient-brand flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-glow)]">
                    <Icon className="size-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                      {mod.titulo}
                      {soAdmin && <span className={ADMIN_ONLY_TAG}>Só admin</span>}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">{mod.descricao}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-primary" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppLayout>
  );
}
