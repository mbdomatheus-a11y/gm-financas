import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/**
 * Seletor de mês por clique (item de melhoria do período personalizado do
 * fluxo de caixa, 2026-09-26): em vez de digitar "AAAA-MM" num
 * `<input type="month">`, mostra uma grade com os 12 meses — só o ano
 * precisa ser digitado (com setas pra andar ano a ano também). `value` e
 * `onChange` usam o mesmo formato "AAAA-MM" de sempre, então dá pra trocar
 * o input por este componente sem mudar nada de quem consome o valor.
 */
export function MonthPicker({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [ano, mesStr] = value.split("-");
  const anoNum = Number(ano) || new Date().getFullYear();
  const mesNum = Number(mesStr) || 1;
  const [anoDigitado, setAnoDigitado] = useState(ano);

  function abrir(v: boolean) {
    setOpen(v);
    if (v) setAnoDigitado(ano);
  }

  function escolher(mes: number) {
    onChange(`${anoDigitado || ano}-${String(mes).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-8 justify-start text-xs font-normal", className)}
          aria-label={ariaLabel}
        >
          {MESES_ABREV[mesNum - 1]}/{ano}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setAnoDigitado(String(Number(anoDigitado || ano) - 1))}
            aria-label="Ano anterior"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Input
            value={anoDigitado}
            onChange={(e) => setAnoDigitado(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="h-7 w-16 text-center text-sm"
            inputMode="numeric"
            aria-label="Ano"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setAnoDigitado(String(Number(anoDigitado || ano) + 1))}
            aria-label="Próximo ano"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MESES_ABREV.map((label, i) => {
            const mes = i + 1;
            const selecionado = mes === mesNum && (anoDigitado || ano) === ano;
            return (
              <Button
                key={label}
                type="button"
                variant={selecionado ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => escolher(mes)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
