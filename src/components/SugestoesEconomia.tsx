import { useNavigate } from "@tanstack/react-router";
import { Check, Lightbulb, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas } from "@/hooks/useFinance";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { sugerirEconomias } from "@/lib/sugestoes-economia";

const CHAVE = "controlall:sugestoes-dispensadas";
const CHAVE_REVISADAS = "controlall:sugestoes-revisadas";

function lerLista(chave: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function gravarLista(chave: string, lista: string[]) {
  try {
    localStorage.setItem(chave, JSON.stringify(lista.slice(-200)));
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
  const [dispensadas, setDispensadas] = useState<string[]>(() => lerLista(CHAVE));
  const [revisadas, setRevisadas] = useState<string[]>(() => lerLista(CHAVE_REVISADAS));

  const sugestoes = useMemo(
    () =>
      sugerirEconomias(despesas as any[], cotacao)
        .filter((s) => !dispensadas.includes(s.id) && !revisadas.includes(s.id))
        .slice(0, 4),
    [despesas, cotacao, dispensadas, revisadas],
  );

  if (!prontas || sugestoes.length === 0) return null;

  function dispensar(id: string) {
    const nova = [...dispensadas, id];
    setDispensadas(nova);
    gravarLista(CHAVE, nova);
  }

  function marcarRevisada(id: string) {
    const nova = [...revisadas, id];
    setRevisadas(nova);
    gravarLista(CHAVE_REVISADAS, nova);
    toast.success("Marcado como revisado");
  }

  return (
    <Card className={className ?? "mb-4 overflow-hidden"}>
      <CardContent className="p-4 sm:p-5">
        <header className="mb-3 flex items-center gap-2">
          <Lightbulb className="size-4 text-warning-foreground" aria-hidden />
          <h2 className="text-base font-bold tracking-tight">Cobranças para revisar</h2>
          <span className="text-xs text-muted-foreground">sugestões automáticas, não é recomendação financeira</span>
        </header>
        <ul className="-mx-2 space-y-1">
          {sugestoes.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-lg text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => void navigate({ to: "/despesas", search: { busca: s.busca, mes: "todos" } as any })}
                title={s.texto}
              >
                <p className="truncate text-sm font-semibold">{s.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{s.texto}</p>
              </button>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-destructive">
                {s.anual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                <span className="block text-[11px] font-normal text-muted-foreground">por ano</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1 rounded-full px-3 text-xs"
                aria-label={`Já revisei: ${s.titulo}`}
                onClick={() => marcarRevisada(s.id)}
              >
                <Check className="size-3.5" aria-hidden />
                Já revisei
              </Button>
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
