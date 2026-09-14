import { useMemo, useState } from "react";

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
import { somarIntervaloData, type UnidadeIntervalo } from "@/lib/calculadora-datas";

const UNIDADES_INTERVALO: { id: UnidadeIntervalo; label: string }[] = [
  { id: "dias", label: "dias" },
  { id: "meses", label: "meses" },
  { id: "anos", label: "anos" },
  { id: "seculos", label: "séculos" },
];

/** Data-base + operação (soma/subtrai) + quantidade + unidade → nova data. */
export function DataMaisIntervalo() {
  const hoje = toISODate(new Date());
  const [base, setBase] = useState(hoje);
  const [quantidade, setQuantidade] = useState("30");
  const [unidade, setUnidade] = useState<UnidadeIntervalo>("dias");
  const [operacao, setOperacao] = useState<"soma" | "subtrai">("soma");

  const resultado = useMemo(() => {
    const n = Number(quantidade);
    if (!base || !Number.isFinite(n)) return null;
    return somarIntervaloData(base, operacao === "soma" ? n : -n, unidade);
  }, [base, quantidade, unidade, operacao]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="data-base">Data de partida</Label>
        <Input id="data-base" type="date" value={base} onChange={(e) => setBase(e.target.value)} />
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-2 sm:grid-cols-[auto_auto_1fr]">
        <div className="space-y-1.5">
          <Label>Operação</Label>
          <Select value={operacao} onValueChange={(v) => setOperacao(v as "soma" | "subtrai")}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soma">+</SelectItem>
              <SelectItem value="subtrai">−</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantidade-intervalo">Quantidade</Label>
          <Input
            id="quantidade-intervalo"
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Unidade</Label>
          <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeIntervalo)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES_INTERVALO.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {resultado && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{formatDate(resultado)}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(base)} {operacao === "soma" ? "+" : "−"} {quantidade} {unidade}
          </p>
        </div>
      )}
    </div>
  );
}
