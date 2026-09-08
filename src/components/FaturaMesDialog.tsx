import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { useCartoes, useDespesas } from "@/hooks/useFinance";
import { currentMonthKey, formatBRL, monthKey, monthLabelLong } from "@/lib/format";

/** Último dia do mês da competência, ou o dia de vencimento do cartão quando houver. */
function vencimentoDoMes(competencia: string, dia?: number | null): string {
  const [y, m] = competencia.split("-").map(Number);
  const ultimo = new Date(y!, m!, 0).getDate();
  const d = Math.min(dia && dia > 0 ? dia : ultimo, ultimo);
  return `${competencia}-${String(d).padStart(2, "0")}`;
}

export function FaturaMesDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cartaoId, setCartaoId] = useState<string>("");
  const [competencia, setCompetencia] = useState(currentMonthKey());
  const [valor, setValor] = useState("");
  const [inclui, setInclui] = useState("sim");

  const qc = useQueryClient();
  const { user } = useAuthData();
  const { data: cartoes = [] } = useCartoes();
  const { data: despesas = [] } = useDespesas();

  const fatura = useQuery({
    queryKey: ["fatura-mes", cartaoId, competencia],
    enabled: open && !!cartaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fatura_mes")
        .select("*")
        .eq("cartao_id", cartaoId)
        .eq("competencia", competencia)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const cartao = (cartoes as any[]).find((c) => c.id === cartaoId) ?? null;

  /** Parcelas já previstas para o cartão no mês, sem contar o lançamento avulso desta fatura. */
  const previstas = useMemo(() => {
    if (!cartaoId) return 0;
    let total = 0;
    for (const d of despesas as any[]) {
      if (d.cartao_id !== cartaoId) continue;
      if (d.origem === "fatura_rapida") continue;
      for (const p of d.parcelas ?? [])
        if (monthKey(p.vencimento) === competencia) total += Number(p.valor);
    }
    return total;
  }, [despesas, cartaoId, competencia]);

  const totalInformado = Number(String(valor).replace(",", ".")) || 0;
  const avulso = inclui === "sim" ? totalInformado - previstas : totalInformado;
  const totalMes = inclui === "sim" ? totalInformado : totalInformado + previstas;
  const negativo = avulso < -0.005;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!cartaoId) throw new Error("Escolha o cartão.");
      if (totalInformado <= 0) throw new Error("Informe o valor total da fatura.");
      if (negativo) throw new Error("O total informado é menor que as parcelas já previstas.");

      const vencimento = vencimentoDoMes(competencia, cartao?.dia_vencimento);
      const registro = fatura.data as any;
      const valorAvulso = Number(avulso.toFixed(2));
      let despesaId: string | null = registro?.despesa_avulsa_id ?? null;

      if (despesaId) {
        const { error } = await supabase
          .from("despesas")
          .update({
            valor_total: valorAvulso,
            data_compra: vencimento,
            data_primeira_parcela: vencimento,
          })
          .eq("id", despesaId);
        if (error) throw error;
        const { error: pErr } = await supabase
          .from("parcelas")
          .update({ valor: valorAvulso, vencimento })
          .eq("despesa_id", despesaId);
        if (pErr) throw pErr;
      }

      if (!despesaId && valorAvulso > 0.005) {
        const { data: nova, error } = await supabase
          .from("despesas")
          .insert({
            descricao: `Gastos do cartão — ${monthLabelLong(competencia)}`,
            valor_total: valorAvulso,
            moeda: "BRL",
            categoria: "outros",
            tipo: "variavel",
            data_compra: vencimento,
            total_parcelas: 1,
            data_primeira_parcela: vencimento,
            cartao_id: cartaoId,
            banco_id: cartao?.banco_id ?? null,
            banco_nome: cartao?.bancos?.nome ?? null,
            cartao_final: cartao?.final ?? null,
            direcao: "debito",
            origem: "fatura_rapida",
            categoria_confirmada: false,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        despesaId = nova.id;
        const { error: pErr } = await supabase.from("parcelas").insert({
          despesa_id: despesaId,
          numero: 1,
          total: 1,
          valor: valorAvulso,
          moeda: "BRL",
          vencimento,
          paga: false,
          origem: "fatura_rapida",
          valor_estimado: true,
        });
        if (pErr) throw pErr;
      }

      const payload = {
        cartao_id: cartaoId,
        competencia,
        total_informado: totalInformado,
        inclui_parcelas: inclui === "sim",
        status: "aberta",
        despesa_avulsa_id: despesaId,
        created_by: user?.id ?? null,
      };
      if (registro) {
        const { error } = await supabase.from("fatura_mes").update(payload).eq("id", registro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fatura_mes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["fatura-mes"] });
      toast.success("Fatura do mês registrada.");
      setOpen(false);
      setValor("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const meses = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 15 }, (_, i) =>
      monthKey(new Date(now.getFullYear(), now.getMonth() - 12 + i, 1)),
    );
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Receipt className="mr-2 size-4" /> Fatura do mês
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fatura do mês</DialogTitle>
          <DialogDescription>
            Informe só o total da fatura. As parcelas em andamento continuam nos meses seguintes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Cartão</Label>
            <Select value={cartaoId} onValueChange={setCartaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o cartão" />
              </SelectTrigger>
              <SelectContent>
                {(cartoes as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {(c.apelido || c.titular || "Cartão") + (c.final ? ` •${c.final}` : "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Mês</Label>
              <Select value={competencia} onValueChange={setCompetencia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabelLong(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Valor total da fatura</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Esse total…</Label>
            <Select value={inclui} onValueChange={setInclui}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Já inclui as parcelas em andamento</SelectItem>
                <SelectItem value="nao">Não inclui as parcelas (somar por cima)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Parcelas já previstas</span>
              <span className="tabular-nums">{formatBRL(previstas)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Gastos do cartão (avulso)</span>
              <span className={`tabular-nums ${negativo ? "text-destructive" : ""}`}>
                {formatBRL(avulso)}
              </span>
            </p>
            <p className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>Total do mês nesse cartão</span>
              <span className="tabular-nums">{formatBRL(totalMes)}</span>
            </p>
            {negativo && (
              <p className="mt-2 text-xs text-destructive">
                O total informado é menor que as parcelas já lançadas. Revise o valor ou escolha
                “Não inclui as parcelas”.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || negativo}>
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar fatura
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
