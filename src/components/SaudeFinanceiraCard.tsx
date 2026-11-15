import { useState } from "react";
import { HeartPulse } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSaudeFinanceira } from "@/hooks/useSaudeFinanceira";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { COR_FAIXA, type SaudeFinanceira } from "@/lib/saude-financeira";
import { cn } from "@/lib/utils";

/** Régua do vermelho ao verde com a bolinha na nota. */
export function ReguaSaude({ nota, className }: { nota: number; className?: string }) {
  return (
    <div className={cn("relative h-2 w-full rounded-full", className)} style={{ background: `linear-gradient(90deg, ${COR_FAIXA.critica}, ${COR_FAIXA.atencao} 45%, ${COR_FAIXA.boa} 70%, ${COR_FAIXA.otima})` }}>
      <span
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
        style={{ left: `${Math.max(2, Math.min(98, nota))}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function esconderValores(t: string, ocultar: boolean) {
  return ocultar ? t.replace(/R\$ ?[\d.,]+/g, "R$ ••••") : t;
}

export function DetalheSaude({ saude, ocultar }: { saude: SaudeFinanceira; ocultar: boolean }) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-6xl font-extrabold tracking-[-0.04em]" style={{ color: COR_FAIXA[saude.faixa] }}>{saude.nota}</p>
        <p className="font-bold" style={{ color: COR_FAIXA[saude.faixa] }}>{saude.rotulo}</p>
      </div>
      <ReguaSaude nota={saude.nota} />
      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Crítica</span><span>Atenção</span><span>Boa</span><span>Ótima</span>
      </div>
      {saude.pilares.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border/60 p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-bold">{p.titulo}</p>
            <p className="text-sm"><span className="font-bold">{p.pontos}</span><span className="text-muted-foreground">/{p.max}</span></p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(p.pontos / p.max) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{esconderValores(p.texto, ocultar)}</p>
          {p.dica ? <p className="mt-1 text-sm font-medium text-primary">{esconderValores(p.dica, ocultar)}</p> : null}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Calculada com o ciclo atual: sobra, reserva, contas em dia, uso do cartão e constância. Fechar o ciclo no negativo limita a nota a 39.
      </p>
    </div>
  );
}

/** Saúde financeira no Início (15/11/2026): nota de 0 a 100 e régua; toque abre os pilares. */
export function SaudeFinanceiraCard({ className }: { className?: string }) {
  const { saude } = useSaudeFinanceira();
  const { ocultarValores } = usePrivacidadeValores();
  const [aberto, setAberto] = useState(false);
  if (!saude) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={saude.semDados ? "Saúde financeira: lance seus primeiros movimentos" : `Saúde financeira ${saude.nota} de 100, ${saude.rotulo}. Ver detalhes`}
        className={cn("block w-full rounded-3xl border border-border/60 bg-card p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40", className)}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <HeartPulse className="size-4" aria-hidden="true" /> Saúde financeira
          </span>
          <span className="text-sm font-semibold text-primary">Detalhes ›</span>
        </div>
        {saude.semDados ? (
          <p className="mt-3 text-sm text-muted-foreground">Lance seus primeiros movimentos para ver sua nota de 0 a 100.</p>
        ) : (
          <>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-[-0.03em]" style={{ color: COR_FAIXA[saude.faixa] }}>{saude.nota}</span>
              <span className="font-bold" style={{ color: COR_FAIXA[saude.faixa] }}>{saude.rotulo}</span>
            </p>
            <ReguaSaude nota={saude.nota} className="mt-3" />
          </>
        )}
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saúde financeira</DialogTitle>
            <DialogDescription>O que pesa na sua nota e o que fazer para subir.</DialogDescription>
          </DialogHeader>
          <DetalheSaude saude={saude} ocultar={ocultarValores} />
        </DialogContent>
      </Dialog>
    </>
  );
}
