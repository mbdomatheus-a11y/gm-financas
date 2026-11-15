import { Link } from "@tanstack/react-router";
import { ChevronRight, Flame } from "lucide-react";

import { useJornada } from "@/hooks/useJornada";
import { fraseJornada } from "@/lib/jornada";
import { cn } from "@/lib/utils";

/** Minha jornada no Início: sequência, nível e progresso. Some quando a pessoa desliga em Minha jornada. */
export function JornadaInicioCard({ className }: { className?: string }) {
  const { jornada: j } = useJornada();
  if (!j || !j.visivel) return null;
  const emChamas = j.sequencia > 0;
  return (
    <Link
      to="/jornada"
      aria-label={`Minha jornada. Nível ${j.nivel}, ${j.titulo}. ${fraseJornada(j)}`}
      className={cn(
        "block rounded-3xl border border-border/60 bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            emChamas ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
          )}
        >
          <Flame className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold">
            Nível {j.nivel} · {j.titulo}
          </span>
          <span className="block text-sm text-muted-foreground">{fraseJornada(j)}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={j.expDoNivelAtual}
        aria-valuenow={j.expNoNivel}
        aria-label={`Progresso para o nível ${j.nivel + 1}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.round(j.progresso * 100))}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {j.expNoNivel} de {j.expDoNivelAtual} EXP para o nível {j.nivel + 1} · {j.feitas} de {j.conquistas.length} conquistas
      </p>
    </Link>
  );
}
