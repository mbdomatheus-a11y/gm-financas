import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { useNumerosCiclo } from "@/hooks/useNumerosCiclo";
import { nomeDoCiclo } from "@/lib/rotulo-ciclo";
import { formatBRL } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * Extrato do ciclo, dia a dia (15/11/2026): do dia seguinte à virada até o fim do ciclo, com o que entrou,
 * o que saiu e o saldo corrido. Até hoje é o real; depois, o previsto (contas fixas, receitas e faturas).
 * Mesma série do "Vai sobrar" (numeros-ciclo.ts). Igual à aba Por dia do app.
 */
export function ExtratoPorDia() {
  const vigente = useCompetenciaVigente();
  const n = useNumerosCiclo(vigente);
  const [verTudo, setVerTudo] = useState(false);
  const negativo = n.serie.find((s) => s.projetado && s.saldo < 0);
  const linhas = verTudo ? n.serie : n.serie.filter((s) => s.entrou || s.saiu || !s.projetado || s.iso === n.hoje);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-border/60 bg-card p-5">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{nomeDoCiclo(n.mes)} · {n.rotulo}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-[-0.03em]">{formatBRL(n.real.sobra)}</p>
          <p className="text-xs text-muted-foreground">em conta hoje</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-muted-foreground">Vai sobrar no fim</p>
          <p className={cn("text-xl font-bold", n.previsto.sobra < 0 ? "text-destructive" : "text-success")}>{formatBRL(n.previsto.sobra)}</p>
        </div>
      </div>

      {negativo && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No ritmo previsto, o saldo fica negativo em {negativo.iso.split("-").reverse().slice(0, 2).join("/")}.
        </p>
      )}

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
        <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr] gap-2 border-b border-border/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Dia</span>
          <span className="text-right">Entrou</span>
          <span className="text-right">Saiu</span>
          <span className="text-right">Saldo</span>
        </div>
        <ul className="divide-y divide-border/50">
          {linhas.map((s) => {
            const d = new Date(`${s.iso}T12:00:00`);
            const hoje = s.iso === n.hoje;
            return (
              <li
                key={s.iso}
                className={cn("grid grid-cols-[4.5rem_1fr_1fr_1fr] items-center gap-2 px-4 py-2.5 text-sm tabular-nums", s.projetado && "text-muted-foreground", hoje && "bg-primary/5")}
              >
                <span>
                  <strong className={cn(!s.projetado && "text-foreground")}>{s.rotulo}</strong> <span className="text-xs">{DIAS_SEMANA[d.getDay()]}</span>
                  {hoje && <span className="ml-1 text-[10px] font-bold uppercase text-primary">hoje</span>}
                </span>
                <span className={cn("text-right", s.entrou > 0 && !s.projetado && "text-success")}>{s.entrou > 0 ? formatBRL(s.entrou) : ""}</span>
                <span className="text-right">{s.saiu > 0 ? formatBRL(s.saiu) : ""}</span>
                <span className={cn("text-right font-semibold", s.saldo < 0 ? "text-destructive" : !s.projetado && "text-foreground")}>{formatBRL(s.saldo)}</span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setVerTudo((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-border/60 py-3 text-sm font-semibold text-primary"
        >
          {verTudo ? "Mostrar só dias com movimento" : "Mostrar todos os dias"}
          <ChevronDown className={cn("size-4 transition-transform", verTudo && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Em cinza, o previsto: contas fixas, receitas que repetem e faturas a vencer.</p>
    </div>
  );
}
