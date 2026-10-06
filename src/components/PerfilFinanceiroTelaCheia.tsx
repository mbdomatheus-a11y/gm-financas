import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useAuthData";
import { useGamificacaoFinanceira } from "@/components/GamificacaoFinanceira";
import { pularPerfilFinanceiro, salvarPerfilFinanceiro } from "@/lib/perfil-financeiro.functions";

function paraNumero(v: string): number {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Item 12 (2026-10-05): na Lista de compras, quem ainda não respondeu as 3
 * perguntas vê uma tela cheia pedindo o preenchimento. Se clicar em "Não
 * responder", isso é salvo no perfil e a tela não volta (a Lista segue como antes).
 */
export function PerfilFinanceiroTelaCheia() {
  const g = useGamificacaoFinanceira();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarPerfilFinanceiro);
  const pularFn = useServerFn(pularPerfilFinanceiro);
  const [renda, setRenda] = useState("");
  const [horas, setHoras] = useState("160");
  const [fixos, setFixos] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fechado, setFechado] = useState(false);

  const p = profile as any;
  if (!p || g.respondido || p.perfil_financeiro_pulado_em || fechado) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const rendaNum = paraNumero(renda);
    const horasNum = Math.round(paraNumero(horas));
    if (rendaNum <= 0) return void toast.error("Informe sua renda líquida mensal");
    if (horasNum < 1 || horasNum > 720) return void toast.error("Horas no mês: entre 1 e 720");
    setOcupado(true);
    try {
      await salvarFn({
        data: {
          rendaLiquida: rendaNum,
          horasMes: horasNum,
          compromissosFixos: fixos.trim() ? paraNumero(fixos) : null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Pronto! Calculamos o valor da sua hora.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setOcupado(false);
    }
  }

  async function naoResponder() {
    setOcupado(true);
    try {
      await pularFn();
      setFechado(true);
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quanto vale o seu tempo"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-background p-4"
    >
      <form onSubmit={salvar} className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock className="size-7" />
          </div>
          <h2 className="text-xl font-bold">Quanto custa cada compra em horas de trabalho?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Responda 3 perguntas rápidas e a sua Lista de compras passa a mostrar o custo de cada
            item em horas de trabalho. Seus dados ficam só na sua conta.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tc-renda">Quanto você recebe líquido por mês? (R$)</Label>
          <Input id="tc-renda" inputMode="decimal" value={renda} placeholder="3.500,00" onChange={(e) => setRenda(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tc-horas">Quantas horas trabalha por mês?</Label>
          <Input id="tc-horas" inputMode="numeric" value={horas} placeholder="160" onChange={(e) => setHoras(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tc-fixos">Contas fixas por mês? (R$, opcional)</Label>
          <Input id="tc-fixos" inputMode="decimal" value={fixos} placeholder="1.800,00" onChange={(e) => setFixos(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={ocupado}>
          Calcular e continuar
        </Button>
        <Button type="button" variant="ghost" className="w-full text-muted-foreground" disabled={ocupado} onClick={naoResponder}>
          Não responder
        </Button>
      </form>
    </div>
  );
}
