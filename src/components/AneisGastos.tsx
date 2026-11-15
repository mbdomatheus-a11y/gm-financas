import { useMemo, useState } from "react";

import { arcoAnel, corClara, montarAneis, type GastoAnel } from "@/lib/aneis-gastos";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const GAP = 0.012;

/**
 * Mapa de gastos em anéis (15/11/2026), em Para onde vai. Toque numa categoria para aproximar e ver os
 * lugares; toque no centro para voltar. Com valores ocultos mostra só percentuais. Igual ao app.
 */
export function AneisGastos({
  atual,
  anterior,
  nomesContas,
  ocultar,
}: {
  atual: GastoAnel[];
  anterior: GastoAnel[];
  nomesContas: Map<string, string>;
  ocultar: boolean;
}) {
  const { total, categorias } = useMemo(() => montarAneis(atual, anterior), [atual, anterior]);
  const [aberta, setAberta] = useState<string | null>(null);
  const foco = categorias.find((c) => c.categoria === aberta) ?? null;
  const valor = (v: number) => (ocultar ? "R$ ••••" : formatBRL(v));

  if (total <= 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sem gastos neste ciclo ainda.</p>;

  const C = 150;
  let a = 0;
  const fatias = foco
    ? foco.lugares.map((l, i) => {
        const a0 = a;
        a += l.pct * Math.PI * 2;
        return { chave: l.chave, a0, a1: a, cor: i === 0 ? foco.cor : corClara(foco.cor, 0.15 + i * 0.12), rotulo: l.descricao, pct: l.pct };
      })
    : null;

  return (
    <div className="grid items-center gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
      <svg viewBox="0 0 300 300" className="mx-auto w-full max-w-[320px]" role="img" aria-label={foco ? `Lugares em ${foco.rotulo}` : "Gastos do ciclo por categoria"}>
        {fatias
          ? fatias.map((f) => (
              <path key={f.chave} d={arcoAnel(C, C, 70, 138, f.a0 + GAP, f.a1 - GAP)} fill={f.cor}>
                <title>{`${f.rotulo}: ${Math.round(f.pct * 100)}%`}</title>
              </path>
            ))
          : categorias.map((c) => {
              const a0 = a;
              a += c.pct * Math.PI * 2;
              let b = a0;
              return (
                <g key={c.categoria} className="cursor-pointer" onClick={() => setAberta(c.categoria)}>
                  <path d={arcoAnel(C, C, 62, 102, a0 + GAP, a - GAP)} fill={c.cor}>
                    <title>{`${c.rotulo}: ${Math.round(c.pct * 100)}%`}</title>
                  </path>
                  {c.lugares.map((l, i) => {
                    const b0 = b;
                    b += l.pct * (a - a0);
                    return <path key={l.chave} d={arcoAnel(C, C, 105, 132, b0 + GAP, b - GAP)} fill={corClara(c.cor, 0.3 + (i % 3) * 0.15)} />;
                  })}
                  <path d={arcoAnel(C, C, 135, 140, a0 + GAP, a - GAP)} fill={c.conta ? "currentColor" : "transparent"} className="text-foreground/40" />
                </g>
              );
            })}
        <g className={cn(foco && "cursor-pointer")} onClick={() => setAberta(null)}>
          <circle cx={C} cy={C} r={foco ? 66 : 58} className="fill-card" />
          <text x={C} y={C - 6} textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold">
            {foco ? foco.rotulo : "Total do ciclo"}
          </text>
          <text x={C} y={C + 16} textAnchor="middle" className="fill-foreground text-[17px] font-extrabold">
            {foco ? (ocultar ? `${Math.round(foco.pct * 100)}%` : valor(foco.total)) : ocultar ? "100%" : valor(total)}
          </text>
          {foco && (
            <text x={C} y={C + 34} textAnchor="middle" className="fill-primary text-[10px] font-semibold">
              toque para voltar
            </text>
          )}
        </g>
      </svg>

      <ul className="space-y-1">
        {(foco ? foco.lugares.map((l, i) => ({ id: l.chave, rotulo: l.descricao, pct: l.pct, total: l.total, delta: null as number | null, cor: i === 0 ? foco.cor : corClara(foco.cor, 0.15 + i * 0.12), conta: null as string | null })) : categorias.map((c) => ({ id: c.categoria, rotulo: c.rotulo, pct: c.pct, total: c.total, delta: c.delta, cor: c.cor, conta: c.conta }))).map((l) => (
          <li key={l.id}>
            <button
              type="button"
              disabled={!!foco}
              onClick={() => setAberta(l.id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="size-3 shrink-0 rounded-full" style={{ background: l.cor }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{l.rotulo}</span>
                {l.conta && <span className="block truncate text-xs text-muted-foreground">Mais pago com {nomesContas.get(l.conta) ?? "conta"}</span>}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-bold">{Math.round(l.pct * 100)}%</span>
                <span className="block text-xs text-muted-foreground">
                  {ocultar ? "" : formatBRL(l.total)}
                  {l.delta !== null && Math.abs(l.delta) >= 1 && !ocultar && (
                    <span className={cn("ml-1", l.delta > 0 ? "text-destructive" : "text-success")}>
                      {l.delta > 0 ? "+" : "−"}{formatBRL(Math.abs(l.delta))}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
