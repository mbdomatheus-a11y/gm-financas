import { useNavigate } from "@tanstack/react-router";
import { Lightbulb, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas } from "@/hooks/useFinance";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { sugerirEconomias } from "@/lib/sugestoes-economia";

const CHAVE = "controlall:sugestoes-dispensadas";

function lerDispensadas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function gravarDispensadas(lista: string[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(-200)));
  } catch {
    // sem armazenamento: só não lembra
  }
}

/**
 * Card do Início: cobranças recorrentes que vale revisar (assinaturas, seguros, telefonia, taxas e aumentos).
 * Regras fixas em lib/sugestoes-economia.ts; o botão leva aos lançamentos já filtrados.
 */
export function SugestoesEconomia({ className }: { className?: string }) {
  const prontas = useFinancasProntas();
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const navigate = useNavigate();
  const [dispensadas, setDispensadas] = useState<string[]>(lerDispensadas);

  const sugestoes = useMemo(
    () =>
      sugerirEconomias(despesas as any[], cotacao)
        .filter((s) => !dispensadas.includes(s.id))
        .slice(0, 4),
    [despesas, cotacao, dispensadas],
  );

  if (!prontas || sugestoes.length === 0) return null;

  function dispensar(id: string) {
    const nova = [...dispensadas, id];
    setDispensadas(nova);
    gravarDispensadas(nova);
  }

  return (
    <Card className={className ?? "mb-4 overflow-hidden"}>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <header className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning/20 text-warning-foreground">
            <Lightbulb className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-balance text-lg font-bold tracking-tight">Cobranças para revisar</h2>
            <p className="text-sm text-muted-foreground">
              Pontos que apareceram nos seus últimos meses. São para você conferir, não recomendação financeira.
            </p>
          </div>
        </header>
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
          {sugestoes.map((s) => (
            <li key={s.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold">{s.titulo}</p>
                <p className="text-sm text-muted-foreground">{s.texto}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-9"
                  onClick={() => void navigate({ to: "/despesas", search: { busca: s.busca, mes: "todos" } as any })}
                >
                  Ver lançamentos
                </Button>
              </div>
              <button
                type="button"
                aria-label={`Dispensar sugestão: ${s.titulo}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => dispensar(s.id)}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
