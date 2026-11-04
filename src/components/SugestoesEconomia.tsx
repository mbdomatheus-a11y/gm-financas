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
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-500" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Para revisar e economizar</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Sugestões automáticas pelas suas cobranças dos últimos meses. São pontos para você conferir, não recomendação financeira.
        </p>
        <ul className="space-y-2">
          {sugestoes.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.titulo}</p>
                <p className="text-xs text-muted-foreground">{s.texto}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-8 text-xs"
                  onClick={() => void navigate({ to: "/despesas", search: { busca: s.busca, mes: "todos" } as any })}
                >
                  Ver lançamentos
                </Button>
              </div>
              <button
                type="button"
                aria-label="Dispensar sugestão"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
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
