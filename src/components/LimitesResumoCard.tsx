import { Link } from "@tanstack/react-router";
import { ChevronRight, Gauge } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type StatusLimite, type UsoLimite, useUsoDosLimites } from "@/hooks/useLimites";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { cn } from "@/lib/utils";

const COR_STATUS: Record<StatusLimite, string> = {
  ok: "bg-success",
  alerta: "bg-warning",
  estourado: "bg-destructive",
};

/** Barra de uso do limite: verde até o alerta, amarela no alerta, vermelha acima de 100%. */
export function BarraLimite({ uso, className }: { uso: UsoLimite; className?: string }) {
  const largura = Math.min(100, Math.max(0, uso.percentual));
  return (
    <div
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(uso.percentual)}
      aria-label={`${uso.limite.categoria}: ${Math.round(uso.percentual)}% do limite`}
    >
      <div className={cn("h-full rounded-full transition-all", COR_STATUS[uso.status])} style={{ width: `${largura}%` }} />
      {uso.limite.alerta_percentual < 100 && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-foreground/25"
          style={{ left: `${uso.limite.alerta_percentual}%` }}
        />
      )}
    </div>
  );
}

/**
 * Resumo compacto dos limites para a home (07/11/2026). Mostra os mais usados primeiro.
 * Não aparece quando não há limites ou a tabela ainda não existe (`ocultarSemLimites`).
 */
export function LimitesResumoCard({
  maximo = 4,
  ocultarSemLimites = true,
  className,
}: {
  maximo?: number;
  ocultarSemLimites?: boolean;
  className?: string;
}) {
  const { usos, resumo, tabelaPendente, pronto } = useUsoDosLimites();
  const { formatar } = usePrivacidadeValores("limites-home");

  if (!pronto) return null;
  if ((tabelaPendente || usos.length === 0) && ocultarSemLimites) return null;

  return (
    <Card className={cn("rounded-3xl", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4 text-primary" aria-hidden="true" /> Limites do ciclo
        </CardTitle>
        <Link to="/limites" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          Ver todos <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3.5">
        {usos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum limite criado.{" "}
            <Link to="/limites" className="font-medium text-primary hover:underline">
              Criar limite
            </Link>
          </p>
        ) : (
          <>
            {usos.slice(0, maximo).map((uso) => (
              <div key={uso.limite.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{uso.limite.categoria}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      uso.status === "estourado" ? "font-semibold text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {formatar(uso.gasto)} / {formatar(uso.limite.valor_mensal)}
                  </span>
                </div>
                <BarraLimite uso={uso} className="h-1.5" />
              </div>
            ))}
            {(resumo.alerta > 0 || resumo.estourados > 0) && (
              <p className="pt-1 text-xs text-muted-foreground">
                {resumo.estourados > 0 && (
                  <span className="font-medium text-destructive">
                    {resumo.estourados} {resumo.estourados === 1 ? "estourado" : "estourados"}
                  </span>
                )}
                {resumo.estourados > 0 && resumo.alerta > 0 && " · "}
                {resumo.alerta > 0 && (
                  <span className="font-medium text-warning-foreground dark:text-warning">
                    {resumo.alerta} em alerta
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
