import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { ConteudoBancosPluggy } from "@/components/BancosPluggy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useModulosGlobais, usePermissoes } from "@/hooks/useAuthData";
import { MODULOS_INFO } from "@/lib/areas";

export const Route = createFileRoute("/_authenticated/pluggy")({
  head: () => ({ meta: [{ title: "Bancos (teste) | Control ALL" }, { name: "robots", content: "noindex" }] }),
  component: PluggyPage,
});

/**
 * 07/11/2026: Open Finance virou o módulo "open_finance" (desligado por padrão em modulos_globais).
 * A tela de bancos só abre com o módulo habilitado; o admin do site continua vendo (padrão "Só admin"),
 * inclusive antes da migration 20261107140000_modulo_open_finance.sql criar a linha do módulo.
 * O guard fica aqui (e não em MODULO_POR_ROTA) para não redirecionar o admin antes de saber quem é.
 */
function PluggyPage() {
  const { habilitado, isLoading } = useModulosGlobais();
  const { isSiteAdmin } = usePermissoes();
  if (isSiteAdmin || habilitado("open_finance")) return <ConteudoBancosPluggy />;
  const info = MODULOS_INFO.open_finance;
  return (
    <AppLayout title={info.titulo} description="Em breve">
      {!isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <Landmark className="size-6" aria-hidden="true" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">{info.descricao}</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/inicio">Voltar para o início</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
