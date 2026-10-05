import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useAuthData";
import { useCotacao } from "@/hooks/useCotacao";
import { useDespesas, useFaturasMes } from "@/hooks/useFinance";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";
import { formatBRL, toBRL } from "@/lib/format";
import { salvarPerfilFinanceiro } from "@/lib/perfil-financeiro.functions";

function paraNumero(v: string): number {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Cálculo da gamificação, alimentado pelas RESPOSTAS do usuário (não mais pelos
 * dados de outra pessoa/grupo). Usuário novo começa zerado e responde 3 perguntas.
 */
export function useGamificacaoFinanceira() {
  const { data: profile } = useProfile();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const cotacao = useCotacao();
  const mesAtual = useCompetenciaVigente();
  const p = profile as any;

  return useMemo(() => {
    const respondido = !!p?.perfil_financeiro_respondido_em;
    const renda = Number(p?.renda_liquida_informada) || 0;
    const horas = Number(p?.horas_trabalho_mes) || 160;
    const fixosInformados = Number(p?.compromissos_fixos_informados) || 0;
    const parcelasMes = aplicarRegrasFaturaMes(
      lancamentosPorCompetencias(despesas as any[], [mesAtual]),
      faturasMes as any[],
    );
    const despesasReais = parcelasMes.reduce(
      (s: number, x: any) => s + toBRL(Number(x.valor), x.despesa?.moeda ?? "BRL", cotacao),
      0,
    );
    // Comprometido: o maior entre o que o usuário já lançou e o que ele informou.
    const comprometido = Math.max(despesasReais, fixosInformados);
    const valorHora = renda > 0 ? renda / horas : 0;
    return {
      respondido,
      renda,
      horas,
      fixosInformados,
      comprometido,
      valorHora,
      valorMinuto: valorHora / 60,
      sobra: Math.max(0, renda - comprometido),
    };
  }, [p, despesas, faturasMes, cotacao, mesAtual]);
}

export function GamificacaoFinanceira() {
  const g = useGamificacaoFinanceira();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarPerfilFinanceiro);
  const [editando, setEditando] = useState(false);
  const [renda, setRenda] = useState("");
  const [horas, setHoras] = useState("");
  const [fixos, setFixos] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!profile) return null;
  const mostrarForm = !g.respondido || editando;

  function abrirEdicao() {
    setRenda(g.renda ? String(g.renda).replace(".", ",") : "");
    setHoras(String(g.horas));
    setFixos(g.fixosInformados ? String(g.fixosInformados).replace(".", ",") : "");
    setEditando(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const rendaNum = paraNumero(renda);
    const horasNum = Math.round(paraNumero(horas));
    if (rendaNum <= 0) {
      toast.error("Informe sua renda líquida mensal");
      return;
    }
    if (horasNum < 1 || horasNum > 720) {
      toast.error("Horas de trabalho no mês: entre 1 e 720");
      return;
    }
    setSalvando(true);
    try {
      await salvarFn({
        data: {
          rendaLiquida: rendaNum,
          horasMes: horasNum,
          compromissosFixos: fixos.trim() ? paraNumero(fixos) : null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setEditando(false);
      toast.success("Pronto! Calculamos o valor da sua hora.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="mb-8 border-primary/30">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Clock className="size-4 text-primary" /> Quanto vale o seu tempo
            </h2>
            <p className="text-xs text-muted-foreground">
              Responda 3 perguntas e veja o custo de cada compra em horas de trabalho.
            </p>
          </div>
          {!mostrarForm && (
            <Button variant="ghost" size="sm" onClick={abrirEdicao} aria-label="Editar respostas">
              <Pencil className="mr-1 size-3.5" /> Editar
            </Button>
          )}
        </div>

        {mostrarForm ? (
          <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-renda">Quanto você recebe líquido por mês? (R$)</Label>
              <Input id="g-renda" inputMode="decimal" value={renda} placeholder="3.500,00" onChange={(e) => setRenda(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-horas">Quantas horas trabalha por mês?</Label>
              <Input id="g-horas" inputMode="numeric" value={horas} placeholder="160" onChange={(e) => setHoras(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-fixos">Contas fixas por mês? (R$, opcional)</Label>
              <Input id="g-fixos" inputMode="decimal" value={fixos} placeholder="1.800,00" onChange={(e) => setFixos(e.target.value)} />
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" disabled={salvando}>Calcular</Button>
              {editando && (
                <Button type="button" variant="outline" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Hora líquida</p>
              <p className="text-lg font-semibold">{formatBRL(g.valorHora)}/h</p>
              <p className="text-[11px] text-muted-foreground">≈ {formatBRL(g.valorMinuto)}/min</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Renda líquida</p>
              <p className="text-lg font-semibold">{formatBRL(g.renda)}</p>
              <p className="text-[11px] text-muted-foreground">{g.horas}h/mês</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Comprometido</p>
              <p className="text-lg font-semibold">{formatBRL(g.comprometido)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="size-3" /> Sobra livre</p>
              <p className="text-lg font-semibold text-success">{formatBRL(g.sobra)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
