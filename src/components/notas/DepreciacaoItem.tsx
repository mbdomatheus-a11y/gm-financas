import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { classificarItemNota } from "@/lib/nota-itens-classificacao";

const PRESETS = [
  { meses: 6, rotulo: "6 meses" },
  { meses: 12, rotulo: "1 ano" },
  { meses: 24, rotulo: "2 anos" },
  { meses: 36, rotulo: "3 anos" },
  { meses: 60, rotulo: "5 anos" },
  { meses: 120, rotulo: "10 anos" },
];

const UNIDADE = { rotulo: "meses" };

export function rotuloVidaUtil(meses: number): string {
  const p = PRESETS.find((x) => x.meses === meses);
  return p ? p.rotulo : `${meses} ${UNIDADE.rotulo}`;
}

/** Atalhos de vida útil (meses/anos). `sugerido` recebe destaque. */
export function PresetsVidaUtil({
  valor,
  sugerido,
  onEscolher,
}: {
  valor: number | null | undefined;
  sugerido?: number | undefined;
  onEscolher: (meses: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRESETS.map((p) => (
        <button
          key={p.meses}
          type="button"
          onClick={() => onEscolher(p.meses)}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            valor === p.meses
              ? "border-primary bg-primary text-primary-foreground"
              : p.meses === sugerido
                ? "border-primary/60 bg-primary/10"
                : "bg-background hover:bg-muted"
          }`}
        >
          {p.rotulo}
          {p.meses === sugerido && valor !== p.meses ? " (sugerido)" : ""}
        </button>
      ))}
    </div>
  );
}

/**
 * Permite apontar depreciação em item de nota JÁ lançada (não só na leitura).
 */
export function DepreciacaoItem({
  item,
}: {
  item: { id: string; descricao: string; deprecia?: boolean | null; meses_depreciacao?: number | null };
}) {
  const qc = useQueryClient();
  const sugerido = classificarItemNota(item.descricao).sugestaoDepreciacao?.meses;
  const [editando, setEditando] = useState(false);
  const [meses, setMeses] = useState<number | null>(item.meses_depreciacao ?? sugerido ?? null);

  const salvar = useMutation({
    mutationFn: async (v: { deprecia: boolean; meses: number | null }) => {
      const { error } = await supabase
        .from("nota_itens")
        .update({ deprecia: v.deprecia, meses_depreciacao: v.deprecia ? v.meses : null } as any)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notas-fiscais"] });
      setEditando(false);
      toast.success("Depreciação atualizada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });

  const ativo = !!item.deprecia && !!item.meses_depreciacao;

  if (!editando) {
    return (
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[11px] text-muted-foreground">
          {ativo ? `Depreciando em ${rotuloVidaUtil(Number(item.meses_depreciacao))}` : "Sem depreciação"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={() => {
            setMeses(item.meses_depreciacao ?? sugerido ?? null);
            setEditando(true);
          }}
        >
          <TrendingDown className="size-3" /> {ativo ? "Editar" : "Depreciar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border bg-background p-2">
      <p className="text-[11px] text-muted-foreground">
        {sugerido ? `Vida útil do bem (sugestão: ${rotuloVidaUtil(sugerido)})` : "Vida útil do bem"}
      </p>
      <PresetsVidaUtil valor={meses} sugerido={sugerido} onEscolher={setMeses} />
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={meses ?? ""}
          onChange={(e) => setMeses(Number(e.target.value) || null)}
          placeholder="Meses"
          className="w-20 rounded border bg-background px-2 py-0.5 text-xs"
        />
        <span className="text-[10px] text-muted-foreground">
          {meses ? `≈ ${(meses / 12).toFixed(1)} ano(s)` : "meses"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={!meses || salvar.isPending}
          onClick={() => salvar.mutate({ deprecia: true, meses })}
        >
          Salvar
        </Button>
        {ativo && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate({ deprecia: false, meses: null })}
          >
            Remover depreciação
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
