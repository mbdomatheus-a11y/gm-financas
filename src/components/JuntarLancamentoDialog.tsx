import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { pluggyRejeitarLancamento } from "@/lib/pluggy.functions";
import { formatBRL, formatDate, monthLabelLong } from "@/lib/format";
import {
  carregarVinculos,
  juntarManterMeu,
  juntarManterOpenFinance,
  listarCandidatos,
  type Candidato,
  type LancamentoOF,
} from "@/lib/juntar-lancamento";

/** 07/11/2026: junta um lançamento do Open Finance com um lançamento que o usuário já tinha. */
export function JuntarLancamentoDialog({
  of,
  lancamentos,
  onFechar,
}: {
  of: LancamentoOF | null;
  /** lancamentosPorCompetencias(despesas, [competencia]) do ciclo do lançamento. */
  lancamentos: any[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const rejeitar = useServerFn(pluggyRejeitarLancamento);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<Candidato | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos-open-finance"],
    queryFn: () => carregarVinculos(supabase),
    enabled: !!of,
  });
  const candidatos = useMemo(
    () => (of ? listarCandidatos(of, lancamentos, vinculos, busca) : []),
    [of, lancamentos, vinculos, busca],
  );

  function fechar() {
    setBusca("");
    setEscolhido(null);
    onFechar();
  }

  async function confirmar(manter: "meu" | "open_finance") {
    if (!of || !escolhido) return;
    setSalvando(true);
    try {
      if (manter === "meu") {
        await juntarManterMeu(supabase, of, escolhido, async (id) => {
          await rejeitar({ data: { transactionId: id } });
        });
        toast.success("Juntado. Seu lançamento ficou pago com o valor e a data do banco.");
      } else {
        await juntarManterOpenFinance(supabase, of, escolhido);
        toast.success("Juntado. A parcela deste mês do seu lançamento foi removida.");
      }
      await qc.invalidateQueries();
      fechar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível juntar os lançamentos.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!of} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Juntar com lançamento existente</DialogTitle>
          <DialogDescription>
            {of ? `${of.descricao} · ${formatBRL(of.valor)} · ${formatDate(of.data)} · ${monthLabelLong(of.competencia)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {!escolhido ? (
          <div className="space-y-3">
            <Input placeholder="Buscar pelo nome ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {candidatos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum lançamento parecido neste ciclo. Tente buscar pelo nome.</p>
            )}
            <div className="space-y-2">
              {candidatos.slice(0, 30).map((c) => (
                <button
                  key={c.parcelaId}
                  onClick={() => setEscolhido(c)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:border-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.descricao}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(c.vencimento)}
                      {c.categoria ? ` · ${c.categoria}` : ""}
                      {c.recorrente ? " · recorrente" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">{formatBRL(c.valor)}</span>
                    {c.porVinculo && <Badge variant="outline" className="text-xs">Já juntado antes</Badge>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Qual deve permanecer? Juntando com <strong>{escolhido.descricao}</strong> ({formatBRL(escolhido.valor)}).
            </p>
            <Button variant="outline" className="h-auto w-full flex-col items-start whitespace-normal py-3 text-left" disabled={salvando} onClick={() => void confirmar("meu")}>
              <span className="font-medium">Manter o meu lançamento</span>
              <span className="text-xs font-normal text-muted-foreground">
                Marca como pago com o valor e a data do banco e remove o do Open Finance.
              </span>
            </Button>
            <Button variant="outline" className="h-auto w-full flex-col items-start whitespace-normal py-3 text-left" disabled={salvando} onClick={() => void confirmar("open_finance")}>
              <span className="font-medium">Manter o do Open Finance</span>
              <span className="text-xs font-normal text-muted-foreground">
                Remove só a parcela deste mês do seu lançamento; a recorrência continua nos outros meses.
              </span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEscolhido(null)} disabled={salvando}>
              Voltar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
