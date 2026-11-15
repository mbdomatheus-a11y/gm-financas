import { createFileRoute } from "@tanstack/react-router";
import {
  BookCheck,
  Coins,
  FileUp,
  Flame,
  Footprints,
  Gauge,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useJornada } from "@/hooks/useJornada";
import { EXP_POR_DIA, fraseJornada } from "@/lib/jornada";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jornada")({
  head: () => ({
    meta: [
      { title: "Minha jornada | Control ALL" },
      { name: "description", content: "Sua sequência de dias, nível e conquistas no Control ALL." },
    ],
  }),
  component: JornadaPage,
});

const ICONES: Record<string, LucideIcon> = {
  Footprints, ListChecks, BookCheck, FileUp, PiggyBank, Coins, Gauge, ReceiptText, Flame, Trophy,
};

function JornadaPage() {
  const { jornada: j, carregando, definirVisivel } = useJornada();
  return (
    <AppLayout title="Minha jornada" description="Sequência, nível e conquistas">
      {!j ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {carregando ? "Carregando sua jornada..." : "A jornada ainda não está disponível. Tente de novo mais tarde."}
          </CardContent>
        </Card>
      ) : (
        <div data-entrada className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-muted-foreground">Nível {j.nivel}</p>
                <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{j.titulo}</h2>
                <div
                  className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={j.expDoNivelAtual}
                  aria-valuenow={j.expNoNivel}
                  aria-label={`Progresso para o nível ${j.nivel + 1}`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.round(j.progresso * 100))}%` }} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {j.expNoNivel} de {j.expDoNivelAtual} EXP para o nível {j.nivel + 1}. Total: {j.exp} EXP.
                </p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5">
                  <Flame className={cn("size-6", j.sequencia > 0 ? "text-warning" : "text-muted-foreground")} aria-hidden="true" />
                  <p className="mt-2 text-3xl font-extrabold tabular-nums">{j.sequencia}</p>
                  <p className="text-sm text-muted-foreground">{j.sequencia === 1 ? "dia seguido" : "dias seguidos"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <Trophy className="size-6 text-primary" aria-hidden="true" />
                  <p className="mt-2 text-3xl font-extrabold tabular-nums">{j.melhorSequencia}</p>
                  <p className="text-sm text-muted-foreground">melhor sequência</p>
                </CardContent>
              </Card>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{fraseJornada(j)}</p>

          <section aria-labelledby="titulo-conquistas" className="space-y-3">
            <h2 id="titulo-conquistas" className="text-lg font-bold">
              Conquistas ({j.feitas} de {j.conquistas.length})
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {j.conquistas.map((q) => {
                const Icone = ICONES[q.iconeSite] ?? Trophy;
                return (
                  <li
                    key={q.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-4",
                      q.feita ? "border-success/40 bg-success/5" : "border-border/60 bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl",
                        q.feita ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icone className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{q.titulo}</span>
                      <span className="block text-sm text-muted-foreground">{q.descricao}</span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-bold tabular-nums", q.feita ? "text-success" : "text-muted-foreground")}>
                      {q.feita ? `+${q.exp} EXP` : `${q.atual}/${q.alvo}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <label htmlFor="jornada-visivel" className="min-w-0 cursor-pointer">
                <span className="block font-semibold">Mostrar minha jornada no Início</span>
                <span className="block text-sm text-muted-foreground">
                  Desligue se preferir o Início sem nível e sequência. Nada é perdido.
                </span>
              </label>
              <Switch
                id="jornada-visivel"
                checked={j.visivel}
                onCheckedChange={(v) => definirVisivel.mutate(v)}
                disabled={definirVisivel.isPending}
              />
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Cada dia com algum registro vale {EXP_POR_DIA} EXP. Conquistas valem mais. Perder a sequência não tira nada do que você já fez.
          </p>
        </div>
      )}
    </AppLayout>
  );
}
