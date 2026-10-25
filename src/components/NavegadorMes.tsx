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
    <div className={`inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5 shadow-sm ${className}`}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-full"
        aria-label="Mês anterior"
        onClick={() => onChange(deslocar(base, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[8.5rem] px-2 text-center text-sm font-medium capitalize">
        {valor ? monthLabelLong(valor) : "Todos os meses"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-full"
        aria-label="Próximo mês"
        onClick={() => onChange(deslocar(base, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-full"
        aria-label="Mês atual"
        title="Mês atual"
        disabled={valor === atual}
        onClick={() => onChange(atual)}
      >
        <CalendarDays className="size-3.5" />
      </Button>
    </div>
  );
}
