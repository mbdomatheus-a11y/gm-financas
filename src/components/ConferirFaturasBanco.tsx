import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileCheck2, Loader2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { IconeBanco } from "@/components/IconeBanco";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCartoes, useDespesas, useFaturasImportadas } from "@/hooks/useFinance";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, monthLabelLong } from "@/lib/format";

type Resultado = {
  vencimento: string;
  total_banco: number | null;
  total_sistema: number;
  diferenca: number;
  casados: number;
  mantidos_do_pdf: number;
  nao_cobrados: { despesa_id: string; descricao: string; valor: number; parcela: string; data_compra: string }[];
};

const mesDe = (iso: string) => String(iso ?? "").slice(0, 7);
function mesesAoRedor(): string[] {
  const hoje = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 3 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Conferência das faturas com o banco (26/10/2026): total do Control ALL x total da fatura real, por
 * cartão e mês, e o botão que concilia uma fatura em PDF com os lançamentos do Open Finance.
 */
export function ConferirFaturasBanco() {
  const qc = useQueryClient();
  const { data: cartoes = [] } = useCartoes();
  const { data: despesas = [] } = useDespesas();
  const { data: pdfs = [] } = useFaturasImportadas();
  const { data: doBanco = [] } = useQuery({
    queryKey: ["cartao-faturas-banco"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cartao_faturas_banco").select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const [cartaoDoPdf, setCartaoDoPdf] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const meses = useMemo(mesesAoRedor, []);

  const totais = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of despesas as any[]) {
      if (!d.cartao_id || d.direcao === "entrada") continue;
      for (const p of d.parcelas ?? []) {
        const k = `${d.cartao_id}|${mesDe(p.vencimento)}`;
        m.set(k, (m.get(k) ?? 0) + Number(p.valor ?? 0));
      }
    }
    return m;
  }, [despesas]);

  const cartoesComMovimento = (cartoes as any[]).filter((c) =>
    meses.some((mes) => (totais.get(`${c.id}|${mes}`) ?? 0) > 0) || (doBanco as any[]).some((f) => f.cartao_id === c.id),
  );

  const conciliar = useMutation({
    mutationFn: async ({ fatura, cartao }: { fatura: string; cartao: string }) => {
      const { data, error } = await (supabase as any).rpc("conciliar_fatura_pdf", { p_fatura: fatura, p_cartao: cartao });
      if (error) throw error;
      return data as Resultado;
    },
    onSuccess: (r) => {
      setResultado(r);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível conferir a fatura."),
  });

  const ajustar = useMutation({
    mutationFn: async ({ despesa, acao }: { despesa: string; acao: "proxima" | "excluir" }) => {
      const { error } = await (supabase as any).rpc("ajustar_lancamento_conciliacao", { p_despesa: despesa, p_acao: acao });
      if (error) throw error;
      return { despesa };
    },
    onSuccess: ({ despesa }) => {
      setResultado((r) => (r ? { ...r, nao_cobrados: r.nao_cobrados.filter((x) => x.despesa_id !== despesa) } : r));
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível ajustar."),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold">Fatura do Control ALL x fatura do banco</p>
            <p className="text-xs text-muted-foreground">
              O total do banco aparece depois de conferir a fatura em PDF daquele mês. Diferença em vermelho precisa de revisão.
            </p>
          </div>
          {cartoesComMovimento.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cartão com lançamentos.</p>}
          <div className="space-y-3">
            {cartoesComMovimento.map((c: any) => (
              <div key={c.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <IconeBanco nome={String(c.bancos?.nome ?? c.apelido ?? "")} bancoId={c.banco_id ?? null} className="size-8 rounded-lg" />
                  <p className="text-sm font-semibold">
                    {c.apelido} •{c.final}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {meses.map((mes) => {
                    const sistema = totais.get(`${c.id}|${mes}`) ?? 0;
                    const banco = (doBanco as any[]).find((f) => f.cartao_id === c.id && mesDe(f.vencimento) === mes);
                    const dif = banco?.total_banco != null ? Math.round((sistema - Number(banco.total_banco)) * 100) / 100 : null;
                    return (
                      <div key={mes} className="rounded-lg bg-muted/40 p-2 text-xs">
                        <p className="capitalize text-muted-foreground">{monthLabelLong(mes)}</p>
                        <p className="font-semibold">{formatBRL(sistema)}</p>
                        {banco?.total_banco != null ? (
                          <p className={dif === 0 ? "text-emerald-600" : "text-red-600"}>
                            Banco {formatBRL(Number(banco.total_banco))}
                            {dif === 0 ? " ✓" : ` · dif. ${formatBRL(dif ?? 0)}`}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">Banco: sem PDF</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold">Conferir fatura em PDF com o Open Finance</p>
            <p className="text-xs text-muted-foreground">
              Importe o PDF da fatura em Importar e escolha aqui o cartão. Cada linha do PDF é casada com o lançamento do banco
              (que passa a vencer nesta fatura); o que só o PDF tem (IOF, ajustes) fica; o que o banco não cobrou aparece para você decidir.
            </p>
          </div>
          {(pdfs as any[]).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fatura em PDF importada.</p>}
          {(pdfs as any[]).map((f) => {
            const escolhido = cartaoDoPdf[f.id] ?? f.cartao_id ?? "";
            const conferida = (doBanco as any[]).find((b) => b.import_fatura_id === f.id);
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-medium capitalize">
                    {f.banco} · vence {String(f.vencimento ?? "").split("-").reverse().join("/")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.arquivo_nome} · total {formatBRL(Number(f.total_declarado ?? 0))}
                  </p>
                </div>
                {conferida && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="size-3" /> conferida
                  </Badge>
                )}
                <Select value={escolhido} onValueChange={(v) => setCartaoDoPdf((s) => ({ ...s, [f.id]: v }))}>
                  <SelectTrigger className="h-9 w-56 text-xs">
                    <SelectValue placeholder="Cartão desta fatura" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cartoes as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.apelido} •{c.final}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!escolhido || conciliar.isPending}
                  onClick={() => conciliar.mutate({ fatura: f.id, cartao: escolhido })}
                >
                  {conciliar.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                  Conferir
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!resultado} onOpenChange={(v) => !v && setResultado(null)}>
        <DialogContent className="max-w-lg">
          {resultado && (
            <>
              <DialogHeader>
                <DialogTitle>Fatura de {String(resultado.vencimento).split("-").reverse().join("/")}</DialogTitle>
                <DialogDescription>
                  {resultado.casados} lançamentos casados com o Open Finance · {resultado.mantidos_do_pdf} só no PDF (mantidos)
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">Banco</p>
                  <p className="font-semibold">{formatBRL(Number(resultado.total_banco ?? 0))}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">Control ALL</p>
                  <p className="font-semibold">{formatBRL(Number(resultado.total_sistema))}</p>
                </div>
                <div className={`rounded-lg p-2 ${Number(resultado.diferenca) === 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  <p className="text-xs text-muted-foreground">Diferença</p>
                  <p className="font-semibold">{formatBRL(Number(resultado.diferenca))}</p>
                </div>
              </div>
              {resultado.nao_cobrados.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <TriangleAlert className="size-4 text-amber-500" /> O banco não cobrou nesta fatura
                  </p>
                  {resultado.nao_cobrados.map((n) => (
                    <div key={n.despesa_id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs">
                      <div className="min-w-[10rem] flex-1">
                        <p className="font-medium">{n.descricao}</p>
                        <p className="text-muted-foreground">
                          {formatBRL(Number(n.valor))} · parcela {n.parcela}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" disabled={ajustar.isPending} onClick={() => ajustar.mutate({ despesa: n.despesa_id, acao: "proxima" })}>
                        Mover p/ próxima
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" disabled={ajustar.isPending} onClick={() => ajustar.mutate({ despesa: n.despesa_id, acao: "excluir" })}>
                        Excluir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
