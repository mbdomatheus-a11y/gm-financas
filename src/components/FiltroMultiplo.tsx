import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type OpcaoFiltro = { valor: string; rotulo: string };

/**
 * Filtro de múltipla escolha. `selecionados = null` significa "todos".
 * Um Set vazio significa "nenhum".
 */
export function FiltroMultiplo({
  titulo,
  opcoes,
  selecionados,
  onChange,
}: {
  titulo: string;
  opcoes: OpcaoFiltro[];
  selecionados: Set<string> | null;
  onChange: (proximo: Set<string> | null) => void;
}) {
  const todas = opcoes.map((o) => o.valor);
  const marcados = selecionados ?? new Set(todas);
  const quantidade = marcados.size;

  let resumo: string;
  if (quantidade === todas.length) resumo = "Todas";
  else if (quantidade === 0) resumo = "Nenhuma";
  else if (quantidade === 1) {
    const unico = [...marcados][0];
    resumo = opcoes.find((o) => o.valor === unico)?.rotulo ?? "1 selecionada";
  } else resumo = `${quantidade} de ${todas.length}`;

  function alternar(valor: string) {
    const base = new Set(marcados);
    if (base.has(valor)) base.delete(valor);
    else base.add(valor);
    onChange(base.size === todas.length ? null : base);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
          <span className="text-muted-foreground">{titulo}:</span>
          <span className="max-w-[160px] truncate font-medium">{resumo}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => onChange(null)}
          >
            Selecionar tudo
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => onChange(new Set())}
          >
            Selecionar nenhum
          </button>
        </div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {opcoes.map((o) => (
            <label
              key={o.valor}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox checked={marcados.has(o.valor)} onCheckedChange={() => alternar(o.valor)} />
              <span className="truncate">{o.rotulo}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
