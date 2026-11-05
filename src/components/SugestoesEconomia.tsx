import { useNavigate } from "@tanstack/react-router";
import { Lightbulb, X } from "lucide-react";
import { useMemo, useState } from "react";

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
      <CardContent className="p-4 sm:p-5">
        <header className="mb-3 flex items-center gap-2">
          <Lightbulb className="size-4 text-warning-foreground" aria-hidden />
          <h2 className="text-base font-bold tracking-tight">Cobranças para revisar</h2>
          <span className="text-xs text-muted-foreground">sugestões automáticas, não é recomendação financeira</span>
        </header>
        <ul className="divide-y divide-border/70">
          {sugestoes.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 py-2.5">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-lg text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => void navigate({ to: "/despesas", search: { busca: s.busca, mes: "todos" } as any })}
                title={s.texto}
              >
                <p className="truncate text-sm font-semibold">{s.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{s.texto}</p>
              </button>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                {s.anual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                <span className="block text-[11px] font-normal text-muted-foreground">por ano</span>
              </span>
              <button
                type="button"
                aria-label={`Dispensar sugestão: ${s.titulo}`}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
