import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCartoes } from "@/hooks/useFinance";
import { supabase } from "@/integrations/supabase/client";
import { diasAntesPadrao, fechamentoPadrao } from "@/lib/fatura-ciclo";

/** Distância em dias (circular no mês) entre hoje e o dia de fechamento. */
function distancia(hoje: number, fecha: number): number {
  const d = Math.abs(hoje - fecha);
  return Math.min(d, 30 - d);
}

const chave = (id: string) => `fechamento-adiado-${id}-${new Date().toISOString().slice(0, 7)}`;

/**
 * Perto da virada da fatura, pergunta se a fatura já fechou e qual o dia de fechamento (o usuário vê no
 * app do banco). Vale para quem não tem Open Finance; a Pluggy não informa a data de fechamento.
 */
export function PerguntaFechamento() {
  const { data: cartoes = [] } = useCartoes();
  const qc = useQueryClient();
  const [dia, setDia] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);

  const hoje = new Date().getDate();
  const alvo = (cartoes as any[]).find((c) => {
    if (c.tipo !== "credito" || !c.dia_vencimento || c.fechamento_confirmado || ocultos.includes(c.id)) return false;
    try {
      if (localStorage.getItem(chave(c.id))) return false;
    } catch {
      // sem storage: pergunta de novo
    }
    const nome = `${c.bancos?.nome ?? ""} ${c.apelido ?? ""}`;
    return distancia(hoje, fechamentoPadrao(Number(c.dia_vencimento), nome)) <= 3;
  });
  if (!alvo) return null;
  const nome = `${alvo.bancos?.nome ?? ""} ${alvo.apelido ?? ""}`;
  const sugestao = fechamentoPadrao(Number(alvo.dia_vencimento), nome);

  async function salvar() {
    const n = Number(dia || sugestao);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      toast.error("Informe um dia entre 1 e 31.");
      return;
    }
    setSalvando(true);
    const { error } = await (supabase as any).from("cartoes").update({ dia_fechamento: n, fechamento_confirmado: true }).eq("id", alvo.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar o fechamento.");
      return;
    }
    toast.success("Fechamento salvo. As próximas faturas usam esse dia.");
    qc.invalidateQueries({ queryKey: ["cartoes"] });
  }
  function adiar() {
    try {
      localStorage.setItem(chave(alvo.id), "1");
    } catch {
      // sem storage
    }
    setOcultos((o) => [...o, alvo.id]);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && adiar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>A fatura do {alvo.apelido} já fechou?</DialogTitle>
          <DialogDescription>
            Estamos perto da virada da fatura (vence dia {alvo.dia_vencimento}). Informe o dia de fechamento, que aparece no app do banco.
            Sem isso usamos {diasAntesPadrao(nome)} dias antes do vencimento (dia {sugestao}).
          </DialogDescription>
        </DialogHeader>
        <Input type="number" min={1} max={31} inputMode="numeric" placeholder={`Dia de fechamento (sugestão ${sugestao})`} value={dia} onChange={(e) => setDia(e.target.value)} />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={adiar}>Agora não</Button>
          <Button onClick={salvar} disabled={salvando}>{dia ? "Salvar" : `Usar dia ${sugestao}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
