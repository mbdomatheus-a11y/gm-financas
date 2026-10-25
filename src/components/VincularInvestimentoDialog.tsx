import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { vincularInvestimentoImportado } from "@/lib/investimentos-pluggy.functions";
import { cn } from "@/lib/utils";

/** Escolhe qual investimento cadastrado à mão é o mesmo que veio do Open Finance (não contar duas vezes). */
export function VincularInvestimentoDialog({
  importado,
  opcoes,
  onFechar,
}: {
  importado: any;
  opcoes: any[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { formatar } = usePrivacidadeValores();
  const vincular = useServerFn(vincularInvestimentoImportado);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => vincular({ data: { importadoId: importado.id, manualId: escolhido! } }),
    onSuccess: () => {
      toast.success("Investimentos ligados. O valor atual agora vem do banco.");
      qc.invalidateQueries({ queryKey: ["investimentos"] });
      onFechar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível ligar os investimentos."),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !m.isPending && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Qual destes é o mesmo investimento?</DialogTitle>
          <DialogDescription>
            {importado.nome} ({formatar(Number(importado.valor_atual))}) veio do Open Finance. Escolha o que você já tinha
            cadastrado: ele passa a receber o valor do banco e o importado sai da lista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2" role="radiogroup">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={escolhido === o.id}
              onClick={() => setEscolhido(o.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm",
                escolhido === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{o.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {o.tipo}
                  {o.instituicao ? ` · ${o.instituicao}` : ""}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatar(Number(o.valor_atual))}</span>
            </button>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar} disabled={m.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => m.mutate()} disabled={!escolhido || m.isPending}>
            {m.isPending ? "Ligando..." : "Ligar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
