import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { CartaoCarregando } from "@/components/CartaoCarregando";
import { useMemo } from "react";
import { CalendarClock, Receipt } from "lucide-react";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useFaturasMes } from "@/hooks/useFinance";
import { useEstruturaCategorias } from "@/hooks/useEstruturaCategorias";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { monthKey, toBRL } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const MESES_FUTUROS = 12;
const LINHAS_VISIVEIS = 8;

type Linha = { nome: string; valor: number };

/** Soma n meses a uma competência "AAAA-MM". */
function somarMes(key: string, n: number): string {
  const [ano = 1970, mes = 1] = key.split("-").map(Number);
  return monthKey(new Date(ano, mes - 1 + n, 1));
}

function ranking(mapa: Map<string, number>): Linha[] {
  return [...mapa]
    .map(([nome, valor]) => ({ nome, valor: Number(valor.toFixed(2)) }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Dois cartões lado a lado, no padrão do Pluggy: despesas do ciclo vigente e
 * despesas futuras (parcelas e compromissos a vencer), com barra por categoria.
 */
export function FluxoDespesas() {
  const financasProntas = useFinancasProntas();
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { formatar } = usePrivacidadeValores();
  const vigente = useCompetenciaVigente();
  const { macroDe } = useEstruturaCategorias("despesa");

  const meses = useMemo(
    () => [vigente, ...Array.from({ length: MESES_FUTUROS }, (_, i) => somarMes(vigente, i + 1))],
    [vigente],
  );

  const parcelas = useMemo(
    () => aplicarRegrasFaturaMes(lancamentosPorCompetencias(despesas as any[], meses), faturasMes as any[]),
    [despesas, meses, faturasMes],
  );

  const { atual, futuro } = useMemo(() => {
    const doCiclo = new Map<string, number>();
    const aVencer = new Map<string, number>();
    for (const p of parcelas) {
      const key = monthKey(p.vencimento);
      const valor = toBRL(Number(p.valor), p.despesa.moeda, cotacao);
      const categoria = macroDe((p.despesa as any).categoria);
      if (key === vigente) doCiclo.set(categoria, (doCiclo.get(categoria) ?? 0) + valor);
      else if (key > vigente) aVencer.set(categoria, (aVencer.get(categoria) ?? 0) + valor);
    }
    return { atual: ranking(doCiclo), futuro: ranking(aVencer) };
  }, [parcelas, vigente, cotacao, macroDe]);

  const totalAtual = atual.reduce((s, l) => s + l.valor, 0);
  const totalFuturo = futuro.reduce((s, l) => s + l.valor, 0);

  if (!financasProntas) return <CartaoCarregando alturaGrafico="h-48" />;
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Bloco
        titulo="Despesas do ciclo"
        icone={<Receipt className="size-3.5" aria-hidden="true" />}
        total={totalAtual}
        cor="text-foreground"
        subtitulo="Lançamentos do ciclo vigente, por categoria"
        linhas={atual}
        vazio="Nenhuma despesa neste ciclo."
        formatar={formatar}
      />
      <Bloco
        titulo="Despesas futuras"
        icone={<CalendarClock className="size-3.5" aria-hidden="true" />}
        total={totalFuturo}
        cor="text-amber-600 dark:text-amber-400"
        subtitulo={`Próximos ${MESES_FUTUROS} meses · parcelas e compromissos a vencer`}
        linhas={futuro}
        vazio="Nenhuma despesa futura registrada."
        formatar={formatar}
      />
    </div>
  );
}

function Bloco({
  titulo,
  icone,
  total,
  cor,
  subtitulo,
  linhas,
  vazio,
  formatar,
}: {
  titulo: string;
  icone: React.ReactNode;
  total: number;
  cor: string;
  subtitulo: string;
  linhas: Linha[];
  vazio: string;
  formatar: (valor: number) => string;
}) {
  const maior = Math.max(0, ...linhas.map((l) => l.valor));
  const visiveis = linhas.slice(0, LINHAS_VISIVEIS);
  const outras = linhas.slice(LINHAS_VISIVEIS).reduce((s, l) => s + l.valor, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {icone}
          {titulo}
        </CardTitle>
        <p className={`text-2xl font-bold tabular-nums tracking-tight ${cor}`}>{formatar(total)}</p>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {visiveis.length === 0 && <p className="text-sm text-muted-foreground">{vazio}</p>}
        {visiveis.map((l, i) => (
          <div key={l.nome} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{l.nome}</span>
              <span className="shrink-0 tabular-nums">{formatar(l.valor)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
              <div
                className="h-full rounded-full"
                style={{ width: `${maior ? (l.valor / maior) * 100 : 0}%`, background: CORES[i % CORES.length] }}
              />
            </div>
          </div>
        ))}
        {outras > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Outras categorias</span>
            <span className="tabular-nums">{formatar(outras)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
