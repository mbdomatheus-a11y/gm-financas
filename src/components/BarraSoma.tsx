import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";

/** Itens 2 e 19 (2026-10-05): seleção de lançamentos para somar na hora (nada é salvo). */
export function useSelecaoSoma() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  /** Marca todos se algum faltar; senão desmarca todos. */
  const alternarVarios = (lista: string[]) =>
    setIds((prev) => {
      const n = new Set(prev);
      const todos = lista.length > 0 && lista.every((i) => n.has(i));
      for (const i of lista) {
        if (todos) n.delete(i);
        else n.add(i);
      }
      return n;
    });
  const todosMarcados = (lista: string[]) => lista.length > 0 && lista.every((i) => ids.has(i));
  const algumMarcado = (lista: string[]) => lista.some((i) => ids.has(i));
  const limpar = () => setIds(new Set());
  return { ids, alternar, alternarVarios, todosMarcados, algumMarcado, limpar };
}

export function BarraSoma({
  qtd,
  total,
  onLimpar,
  rotulo = "selecionado(s)",
}: {
  qtd: number;
  total: number;
  onLimpar: () => void;
  rotulo?: string;
}) {
  if (qtd === 0) return null;
  return (
    <div className="sticky top-16 z-10 mb-3 flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-background/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
      <span>
        {qtd} {rotulo}: <strong className="tabular-nums">{formatBRL(total)}</strong>
      </span>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onLimpar}>
        <X className="size-3" /> Limpar
      </Button>
    </div>
  );
}
