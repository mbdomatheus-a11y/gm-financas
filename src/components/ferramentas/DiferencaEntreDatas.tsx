import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, toISODate } from "@/lib/format";
import { diferencaEntreDatas, type UnidadeTempo } from "@/lib/calculadora-datas";

const UNIDADES_TEMPO: { id: UnidadeTempo; label: string }[] = [
  { id: "segundos", label: "segundos" },
  { id: "minutos", label: "minutos" },
  { id: "horas", label: "horas" },
  { id: "dias", label: "dias" },
  { id: "anos", label: "anos" },
  { id: "seculos", label: "séculos" },
];

/**
 * Calculadora de diferença entre duas datas, em segundos/minutos/horas/
 * dias/anos/séculos. Compartilhada entre a home pública (`/`) e o módulo
 * autenticado `/ferramentas` — mesmo componente, mesmo comportamento nos
 * dois lugares.
 */
export function DiferencaEntreDatas() {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [unidade, setUnidade] = useState<UnidadeTempo>("dias");

  useEffect(() => {
    const hoje = toISODate(new Date());
    setInicio(hoje);
    setFim(hoje);
  }, []);

  const resultado = useMemo(
    () => (inicio && fim ? diferencaEntreDatas(inicio, fim, unidade) : null),
    [inicio, fim, unidade],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="data-inicio">Data inicial</Label>
          <Input
            id="data-inicio"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data-fim">Data final</Label>
          <Input id="data-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Mostrar diferença em</Label>
        <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeTempo)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIDADES_TEMPO.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {resultado != null && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">
            {resultado}{" "}
            <span className="text-base font-medium text-muted-foreground">{unidade}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            entre {formatDate(inicio)} e {formatDate(fim)}
          </p>
        </div>
      )}
    </div>
  );
}
