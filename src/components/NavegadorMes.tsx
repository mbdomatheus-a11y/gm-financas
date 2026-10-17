import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentMonthKey, monthLabelLong } from "@/lib/format";

function deslocar(key: string, delta: number): string {
  const [a = 0, m = 1] = key.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Botões para andar de mês em mês (anterior, próximo, mês atual). Complementa
 * a lista de meses dos filtros, sem substituí-la. `valor` null = "todos os
 * meses": as setas partem do mês atual.
 */
export function NavegadorMes({
  valor,
  onChange,
  className = "",
}: {
  valor: string | null;
  onChange: (mes: string) => void;
  className?: string;
}) {
  const atual = currentMonthKey();
  const base = valor ?? atual;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label="Mês anterior"
        onClick={() => onChange(deslocar(base, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-md border bg-muted/30 px-3 text-sm font-medium capitalize">
        {valor ? monthLabelLong(valor) : "Todos os meses"}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label="Próximo mês"
        onClick={() => onChange(deslocar(base, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 gap-1.5 px-3 text-xs"
        disabled={valor === atual}
        onClick={() => onChange(atual)}
      >
        <CalendarDays className="size-3.5" /> Mês atual
      </Button>
    </div>
  );
}
