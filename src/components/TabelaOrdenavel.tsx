import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ordenação por coluna (31/10/2026, pedido do Matheus): em relatórios e logs, clicar no título da coluna
 * ordena; clicar de novo inverte (maior para menor / menor para maior). Vazios ficam sempre no fim.
 */
export type Direcao = "asc" | "desc";
export type ValorOrdem = string | number | boolean | Date | null | undefined;

export function compararValores(a: ValorOrdem, b: ValorOrdem): number {
  const vazioA = a === null || a === undefined || a === "";
  const vazioB = b === null || b === undefined || b === "";
  if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
  const na = a instanceof Date ? a.getTime() : typeof a === "boolean" ? Number(a) : a;
  const nb = b instanceof Date ? b.getTime() : typeof b === "boolean" ? Number(b) : b;
  if (typeof na === "number" && typeof nb === "number") return na - nb;
  return String(na).localeCompare(String(nb), "pt-BR", { numeric: true, sensitivity: "base" });
}

export function ordenarPor<T>(itens: T[], valor: (item: T) => ValorOrdem, direcao: Direcao): T[] {
  const fator = direcao === "asc" ? 1 : -1;
  return [...itens].sort((x, y) => {
    const vx = valor(x);
    const vy = valor(y);
    const vazioX = vx === null || vx === undefined || vx === "";
    const vazioY = vy === null || vy === undefined || vy === "";
    if (vazioX || vazioY) return vazioX === vazioY ? 0 : vazioX ? 1 : -1; // vazio no fim nos dois sentidos
    return compararValores(vx, vy) * fator;
  });
}

/** Estado de ordenação: a 1ª vez no título ordena do maior para o menor (datas: mais recente primeiro). */
export function useOrdenacao<K extends string>(inicial?: { chave: K; direcao: Direcao }) {
  const [ordem, setOrdem] = useState<{ chave: K; direcao: Direcao } | null>(inicial ?? null);
  function alternar(chave: K) {
    setOrdem((o) => (o && o.chave === chave ? { chave, direcao: o.direcao === "desc" ? "asc" : "desc" } : { chave, direcao: "desc" }));
  }
  return { ordem, alternar, limpar: () => setOrdem(null) };
}

export function BotaoOrdenar({
  rotulo,
  ativo,
  direcao,
  onClick,
  className,
}: {
  rotulo: ReactNode;
  ativo: boolean;
  direcao?: Direcao | undefined;
  onClick: () => void;
  className?: string;
}) {
  const Icone = !ativo ? ArrowUpDown : direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 font-medium hover:text-foreground", ativo && "text-foreground", className)}
      title={ativo ? (direcao === "asc" ? "Do menor para o maior (clique para inverter)" : "Do maior para o menor (clique para inverter)") : "Clique para ordenar"}
    >
      {rotulo}
      <Icone className={cn("size-3 shrink-0", !ativo && "opacity-40")} />
    </button>
  );
}

export type ColunaTabela<T> = {
  titulo: string;
  celula: (item: T) => ReactNode;
  /** Valor usado para ordenar (número, data, texto). Sem ele, a coluna não ordena. */
  ordenar?: (item: T) => ValorOrdem;
  className?: string;
};

/** Tabela de relatório com títulos clicáveis para ordenar. */
export function TabelaOrdenavel<T>({
  itens,
  colunas,
  getChave,
  className,
  celulaClassName = "p-2",
  vazio,
}: {
  itens: T[];
  colunas: ColunaTabela<T>[];
  getChave: (item: T) => string;
  className?: string;
  celulaClassName?: string;
  vazio?: string;
}) {
  const { ordem, alternar } = useOrdenacao<string>();
  const ordenados = useMemo(() => {
    if (!ordem) return itens;
    const col = colunas.find((c) => c.titulo === ordem.chave);
    return col?.ordenar ? ordenarPor(itens, col.ordenar, ordem.direcao) : itens;
  }, [itens, colunas, ordem]);

  return (
    <table className={cn("w-full text-left", className)}>
      <thead>
        <tr className="border-b text-muted-foreground">
          {colunas.map((c) => (
            <th key={c.titulo} className={cn(celulaClassName, c.className)}>
              {c.ordenar ? (
                <BotaoOrdenar
                  rotulo={c.titulo}
                  ativo={ordem?.chave === c.titulo}
                  direcao={ordem?.direcao}
                  onClick={() => alternar(c.titulo)}
                />
              ) : (
                c.titulo
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ordenados.length === 0 && vazio ? (
          <tr>
            <td colSpan={colunas.length} className={cn(celulaClassName, "text-muted-foreground")}>
              {vazio}
            </td>
          </tr>
        ) : (
          ordenados.map((item) => (
            <tr key={getChave(item)} className="border-b last:border-0">
              {colunas.map((c) => (
                <td key={c.titulo} className={cn(celulaClassName, c.className)}>
                  {c.celula(item)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
