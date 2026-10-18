import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useFaturasMes } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { monthKey, toBRL } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

type Modo = "reais" | "percentual";

/**
 * Gastos da competência vigente por categoria. Mostra o total de cada categoria,
 * quanto já foi pago e quanto ainda vai sair (parcelas não pagas com vencimento no mês).
 * Alterna entre valores em R$ e percentual do total.
 */
export function GastosPorCategoria() {
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const competencia = useCompetenciaVigente();
  const { formatar } = usePrivacidadeValores("gastos-por-categoria");
  const [modo, setModo] = useState<Modo>("reais");

  const linhas = useMemo(() => {
    const lancamentos = aplicarRegrasFaturaMes(
      lancamentosPorCompetencias(despesas as any[], [competencia]),
      faturasMes as any[],
    ).filter((l) => monthKey(l.vencimento) === competencia);

    const mapa = new Map<string, { nome: string; total: number; pago: number; aindaVai: number }>();
    for (const l of lancamentos) {
      const nome = (l.despesa as any)?.categoria || "Sem categoria";
      const valor = toBRL(Number(l.valor), (l.despesa as any)?.moeda ?? "BRL", cotacao);
      const item = mapa.get(nome) ?? { nome, total: 0, pago: 0, aindaVai: 0 };
      item.total += valor;
      if (l.paga) item.pago += valor;
      else item.aindaVai += valor;
      mapa.set(nome, item);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [despesas, faturasMes, competencia, cotacao]);

  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);
  const aindaVaiGeral = linhas.reduce((s, l) => s + l.aindaVai, 0);

  function valorTexto(v: number): string {
    if (modo === "percentual") {
      return totalGeral > 0 ? `${((v / totalGeral) * 100).toFixed(1).replace(".", ",")}%` : "0%";
    }
    return formatar(v);
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm">Gastos por categoria no mês</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ainda vai sair: <span className="font-medium text-foreground">{formatar(aindaVaiGeral)}</span>
          </p>
        </div>
        <div className="flex shrink-0 rounded-md border p-0.5 text-xs">
          {(["reais", "percentual"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded px-2 py-1 font-medium transition-colors ${
                modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
              aria-pressed={modo === m}
            >
              {m === "reais" ? "R$" : "%"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        {linhas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum gasto com vencimento neste mês.
          </p>
        ) : (
          linhas.map((l) => {
            const pctBarra = totalGeral > 0 ? (l.total / totalGeral) * 100 : 0;
            const pctPago = l.total > 0 ? (l.pago / l.total) * 100 : 0;
            return (
              <div key={l.nome} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{l.nome}</span>
                  <span className="shrink-0 tabular-nums">{valorTexto(l.total)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="flex h-full" style={{ width: `${pctBarra}%` }}>
                    <div className="h-full bg-primary" style={{ width: `${pctPago}%` }} />
                    <div className="h-full bg-primary/35" style={{ width: `${100 - pctPago}%` }} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Pago {valorTexto(l.pago)} · ainda vai sair {valorTexto(l.aindaVai)}
                </p>
              </div>
            );
          })
        )}
        <p className="text-[11px] text-muted-foreground">
          Barra escura: já pago. Barra clara: ainda vai sair. Considera o mês vigente.
        </p>
      </CardContent>
    </Card>
  );
}
