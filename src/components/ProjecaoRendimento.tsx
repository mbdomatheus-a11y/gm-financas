import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buscarTaxaAnualVigente, buscarValorIndice } from "@/lib/indices.functions";
import { projetarRendimento, type TipoRendimento } from "@/lib/rendimento";
import { formatBRL, formatDate } from "@/lib/format";

interface ProjecaoRendimentoProps {
  valorAtual: number;
  tipoRendimento: TipoRendimento | null;
  percentualRendimento: number | null;
}

const HORIZONTE_MESES = 12;

/**
 * Botão + resultado: busca a taxa-base vigente (CDI/Selic diário no BCB, ou
 * IPCA acumulado 12m) e projeta o valor do investimento 12 meses à frente,
 * mantendo a taxa constante (convenção usual, já que a taxa futura real não
 * é previsível).
 */
export function ProjecaoRendimento({
  valorAtual,
  tipoRendimento,
  percentualRendimento,
}: ProjecaoRendimentoProps) {
  const [resultado, setResultado] = useState<{
    valorFinal: number;
    taxaAnualBase: number;
    dataBase: string | null;
  } | null>(null);

  const buscarTaxa = useServerFn(buscarTaxaAnualVigente);
  const buscarIndice = useServerFn(buscarValorIndice);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tipoRendimento || percentualRendimento == null) {
        throw new Error("Configure o tipo de rendimento antes de calcular.");
      }
      let taxaAnualBase: number;
      let dataBase: string | null;
      if (tipoRendimento === "cdi" || tipoRendimento === "selic") {
        const res = await buscarTaxa({
          data: { indice: tipoRendimento.toUpperCase() as "CDI" | "SELIC" },
        });
        taxaAnualBase = res.percentualAnual;
        dataBase = res.dataBase;
      } else if (tipoRendimento === "ipca_mais") {
        const res = await buscarIndice({ data: { indice: "IPCA", periodicidade: "anual" } });
        taxaAnualBase = res.percentual;
        dataBase = res.dataBase;
      } else {
        taxaAnualBase = 0;
        dataBase = null;
      }
      const projecao = projetarRendimento(
        valorAtual,
        { tipo: tipoRendimento, percentual: percentualRendimento },
        taxaAnualBase,
        HORIZONTE_MESES,
      );
      return { valorFinal: projecao.at(-1)!.valor, taxaAnualBase, dataBase };
    },
    onSuccess: (res) => setResultado(res),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível calcular a projeção"),
  });

  if (!tipoRendimento || percentualRendimento == null) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <TrendingUp className="size-3.5" />
        )}
        Projetar 12 meses
      </Button>
      {resultado && (
        <span className="text-muted-foreground">
          Em 12 meses (taxa-base {resultado.taxaAnualBase.toFixed(2).replace(".", ",")}% a.a.
          {resultado.dataBase ? `, base ${formatDate(resultado.dataBase)}` : ""}):{" "}
          <strong className="text-foreground">{formatBRL(resultado.valorFinal)}</strong>
        </span>
      )}
    </div>
  );
}
