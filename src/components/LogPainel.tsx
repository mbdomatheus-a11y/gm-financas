import { useMemo, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baixarTxt, baixarXlsx } from "@/lib/exportar-planilha";

type Celula = string | number | null | undefined;

export type ColunaLog<T> = { titulo: string; valor: (item: T) => Celula };

/**
 * Painel padrão das telas de log: mostra só os primeiros `limite` registros
 * (em caixa com rolagem), agrupa o restante por dia dentro de seções
 * recolhidas e exporta TUDO (não só o visível) em Excel ou TXT.
 */
export function LogPainel<T>({
  itens,
  getData,
  getChave,
  colunas,
  renderItem,
  nomeArquivo,
  vazio = "Nenhum registro.",
  limite = 15,
}: {
  itens: T[];
  getData: (item: T) => string;
  getChave: (item: T) => string;
  colunas: ColunaLog<T>[];
  renderItem: (item: T) => ReactNode;
  nomeArquivo: string;
  vazio?: string;
  limite?: number;
}) {
  const [abertoTudo, setAbertoTudo] = useState(false);
  const recentes = itens.slice(0, limite);
  const restantes = itens.slice(limite);

  const porDia = useMemo(() => {
    const mapa = new Map<string, T[]>();
    for (const item of restantes) {
      const dia = new Date(getData(item)).toLocaleDateString("pt-BR");
      const lista = mapa.get(dia);
      if (lista) lista.push(item);
      else mapa.set(dia, [item]);
    }
    return [...mapa.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restantes]);

  function exportar(formato: "xlsx" | "txt") {
    const cab = colunas.map((c) => c.titulo);
    const linhas = itens.map((i) => colunas.map((c) => c.valor(i)));
    const base = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}`;
    if (formato === "xlsx") baixarXlsx(base, cab, linhas);
    else baixarTxt(base, cab, linhas);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {itens.length} registro(s){restantes.length > 0 ? `, mostrando os ${recentes.length} mais recentes` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={itens.length === 0}
            onClick={() => exportar("xlsx")}
          >
            <Download className="size-3" /> Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={itens.length === 0}
            onClick={() => exportar("txt")}
          >
            <Download className="size-3" /> TXT
          </Button>
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-lg border p-2">
          {recentes.map((item) => (
            <div key={getChave(item)}>{renderItem(item)}</div>
          ))}
          {restantes.length > 0 && (
            <details
              className="rounded-lg border bg-muted/30 px-3 py-2 text-xs"
              open={abertoTudo}
              onToggle={(e) => setAbertoTudo((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer font-medium">
                Ver mais {restantes.length} registro(s), agrupados por dia
              </summary>
              <div className="mt-2 space-y-1">
                {abertoTudo &&
                  porDia.map(([dia, lista]) => (
                    <details key={dia} className="rounded-md border bg-background px-2 py-1">
                      <summary className="cursor-pointer text-xs font-medium">
                        {dia} <span className="text-muted-foreground">({lista.length})</span>
                      </summary>
                      <div className="mt-1 space-y-1">
                        {lista.map((item) => (
                          <div key={getChave(item)}>{renderItem(item)}</div>
                        ))}
                      </div>
                    </details>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
