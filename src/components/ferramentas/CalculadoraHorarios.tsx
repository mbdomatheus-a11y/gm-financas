import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { somarHorarios, type TermoHorario } from "@/lib/calculadora-datas";

type LinhaHorario = { id: string; sinal: "1" | "-1"; horas: string; minutos: string };

function novaLinhaHorario(sinal: "1" | "-1" = "1"): LinhaHorario {
  return { id: crypto.randomUUID(), sinal, horas: "0", minutos: "0" };
}

/** Soma/subtração de uma lista de durações HH:MM, cada uma com seu sinal. */
export function CalculadoraHorarios() {
  const [linhas, setLinhas] = useState<LinhaHorario[]>([
    { ...novaLinhaHorario("1"), horas: "8", minutos: "0" },
  ]);

  const resultado = useMemo(() => {
    const termos: TermoHorario[] = linhas.map((l) => ({
      sinal: l.sinal === "1" ? 1 : -1,
      horas: Math.max(0, Number(l.horas) || 0),
      minutos: Math.max(0, Number(l.minutos) || 0),
    }));
    return somarHorarios(termos);
  }, [linhas]);

  function atualizar(id: string, patch: Partial<LinhaHorario>) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={l.id} className="flex items-center gap-2">
            {i === 0 ? (
              <span className="w-8 text-center text-sm text-muted-foreground">&nbsp;</span>
            ) : (
              <Select
                value={l.sinal}
                onValueChange={(v) => atualizar(l.id, { sinal: v as "1" | "-1" })}
              >
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">+</SelectItem>
                  <SelectItem value="-1">−</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              type="number"
              min={0}
              value={l.horas}
              onChange={(e) => atualizar(l.id, { horas: e.target.value })}
              className="w-20"
              aria-label="Horas"
            />
            <span className="text-muted-foreground">h</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={l.minutos}
              onChange={(e) => atualizar(l.id, { minutos: e.target.value })}
              className="w-20"
              aria-label="Minutos"
            />
            <span className="text-muted-foreground">min</span>
            {linhas.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 px-2 text-xs text-muted-foreground"
                onClick={() => setLinhas((prev) => prev.filter((x) => x.id !== l.id))}
              >
                Remover
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLinhas((prev) => [...prev, novaLinhaHorario("1")])}
      >
        + Adicionar horário
      </Button>
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-2xl font-bold tabular-nums">
          {resultado.negativo ? "−" : ""}
          {String(resultado.horas).padStart(2, "0")}:{String(resultado.minutos).padStart(2, "0")}
        </p>
        <p className="text-xs text-muted-foreground">Total (horas:minutos)</p>
      </div>
    </div>
  );
}
