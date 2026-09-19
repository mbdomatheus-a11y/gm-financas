import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INDICES_REAJUSTE,
  buscarValorIndice,
  type CodigoIndiceReajuste,
} from "@/lib/indices.functions";
import { formatDate } from "@/lib/format";
import type { Periodicidade } from "@/lib/recorrencia";

const OUTRO = "__outro__";

interface IndiceReajusteFieldProps {
  /** Índice salvo no registro — pode ser um código conhecido, texto livre ("Outro") ou vazio. */
  indice: string;
  onIndiceChange: (value: string) => void;
  periodicidade: Periodicidade;
  /** Chamado quando a busca automática retorna um valor, para preencher o percentual do reajuste. */
  onValorBuscado: (percentual: number) => void;
  onMediaMensalBuscada?: (percentual: number) => void;
}

/**
 * Seletor de índice de reajuste (IPCA, IGP-M, INCC-DI, IGP-DI, CDI, Selic ou
 * "Outro" em texto livre) com busca automática do valor acumulado mais
 * recente via API do Banco Central (SGS), plugando o resultado direto no
 * percentual de reajuste.
 */
export function IndiceReajusteField({
  indice,
  onIndiceChange,
  periodicidade,
  onValorBuscado,
  onMediaMensalBuscada,
}: IndiceReajusteFieldProps) {
  const conhecido = INDICES_REAJUSTE.some((i) => i.codigo === indice);
  const selecao = indice ? (conhecido ? indice : OUTRO) : "";
  const [dataBase, setDataBase] = useState<string | null>(null);
  const [mediaMeses, setMediaMeses] = useState<0 | 6 | 12 | 24>(0);

  const buscar = useServerFn(buscarValorIndice);
  const mutation = useMutation({
    mutationFn: async () =>
      buscar({
        data: {
          indice: indice as CodigoIndiceReajuste,
          periodicidade,
          ...(mediaMeses ? { mediaMeses } : {}),
        },
      }),
    onSuccess: (res) => {
      if (mediaMeses && onMediaMensalBuscada) onMediaMensalBuscada(res.percentual);
      else onValorBuscado(res.percentual);
      setDataBase(res.dataBase);
      toast.success(
        `${indice} ${mediaMeses ? `média mensal de ${mediaMeses} meses` : "acumulado"}: ${res.percentual.toFixed(2).replace(".", ",")}%${
          res.dataBase ? ` (base ${formatDate(res.dataBase)})` : ""
        }`,
      );
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Não foi possível buscar o valor do índice agora"),
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select
          value={selecao}
          onValueChange={(v) => {
            setDataBase(null);
            onIndiceChange(v === OUTRO ? "" : v);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione um índice" />
          </SelectTrigger>
          <SelectContent>
            {INDICES_REAJUSTE.map((i) => (
              <SelectItem key={i.codigo} value={i.codigo}>
                {i.label}
              </SelectItem>
            ))}
            <SelectItem value={OUTRO}>Outro (texto livre)</SelectItem>
          </SelectContent>
        </Select>
        {conhecido && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={`Buscar ${indice} no Banco Central`}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {conhecido && (
        <Select
          value={String(mediaMeses)}
          onValueChange={(value) => setMediaMeses(Number(value) as 0 | 6 | 12 | 24)}
        >
          <SelectTrigger aria-label="Período usado no cálculo do índice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Acumulado da periodicidade escolhida</SelectItem>
            <SelectItem value="6">Média mensal dos últimos 6 meses</SelectItem>
            <SelectItem value="12">Média mensal dos últimos 12 meses</SelectItem>
            <SelectItem value="24">Média mensal dos últimos 24 meses</SelectItem>
          </SelectContent>
        </Select>
      )}
      {mediaMeses > 0 && (
        <p className="text-xs text-muted-foreground">
          A média será aplicada como reajuste mensal. Clique no botão de atualização para calcular.
        </p>
      )}
      {!conhecido && (
        <input
          type="text"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          placeholder="Nome do índice (ex.: contrato específico)"
          value={indice}
          onChange={(e) => onIndiceChange(e.target.value)}
        />
      )}
      {renderDataBaseHint(dataBase)}
    </div>
  );
}

function renderDataBaseHint(dataBase: string | null) {
  if (!dataBase) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Último valor buscado tem como base {formatDate(dataBase)}. Clique de novo para atualizar.
    </p>
  );
}
