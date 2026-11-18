import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { ROTULO_SOBRA_REAL, textoPorDia, textoVaiSobrar, type NumerosCiclo, type PrevisaoRitmo } from "@/lib/numeros-ciclo";

/**
 * Bloco único de sobra. TODA tela que mostra sobra usa este componente, que só lê calcularNumerosCiclo.
 * 18/11/2026 (pedido do Matheus): enxuto. Em destaque "Vai sobrar em DD/MM" com o que JÁ ESTÁ LANÇADO
 * (receitas − despesas lançadas − caixinhas), "Pode gastar R$ Y por dia" e a conta numa linha só.
 * O detalhe (em conta agora, a entrar, a vencer) abre pela seta. A previsão pelo ritmo é um cenário à parte
 * (CenarioRitmo), pequeno, junto do gráfico.
 */
export function SobraCiclo({
  numeros,
  formatar,
  tamanho = "grande",
  className = "",
  mostrarCiclo = true,
}: {
  numeros: NumerosCiclo;
  formatar: (v: number) => string;
  tamanho?: "grande" | "medio";
  className?: string;
  mostrarCiclo?: boolean;
}) {
  const prev = numeros.previsto.sobra;
  const grande = tamanho === "grande";
  return (
    <div className={`space-y-1.5 ${className}`}>
      {mostrarCiclo && <p className="text-xs text-muted-foreground">Ciclo {numeros.textoCiclo}</p>}
      <p className="text-sm font-medium text-muted-foreground">{textoVaiSobrar(numeros)}</p>
      <p
        className={`${grande ? "text-5xl sm:text-6xl" : "text-3xl"} font-extrabold leading-none tabular-nums tracking-tight ${prev >= 0 ? "text-success" : "text-destructive"}`}
      >
        {formatar(prev)}
      </p>
      <p className={`text-sm font-semibold tabular-nums ${prev >= 0 ? "text-foreground" : "text-destructive"}`}>
        {textoPorDia(numeros, formatar)}
      </p>
      <ContaSobra numeros={numeros} formatar={formatar} />
    </div>
  );
}

/**
 * A conta do "Vai sobrar" numa linha: "R$ A receitas − R$ B despesas lançadas [− R$ C caixinhas]".
 * A seta abre o detalhe: em conta agora (já recebido − já pago), o que ainda vai entrar e vencer.
 */
export function ContaSobra({ numeros, formatar }: { numeros: NumerosCiclo; formatar: (v: number) => string }) {
  const [aberto, setAberto] = useState(false);
  const p = numeros.previsto;
  const despesas = p.despesas - p.faturaEstimada;
  return (
    <div className="text-xs text-muted-foreground">
      <button
        type="button"
        aria-expanded={aberto}
        className="inline-flex items-center gap-1 text-left tabular-nums hover:text-foreground"
        onClick={(e) => {
          // Pode estar dentro de um link: abre o detalhe sem navegar.
          e.preventDefault();
          e.stopPropagation();
          setAberto((v) => !v);
        }}
      >
        <span>
          {formatar(p.receitas)} receitas − {formatar(despesas)} despesas
          {p.caixinhas >= 0.5 ? ` − ${formatar(p.caixinhas)} caixinhas` : ""}
        </span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aberto && (
        <dl className="mt-1.5 grid max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 rounded-lg bg-muted/50 p-2 tabular-nums">
          <dt>{ROTULO_SOBRA_REAL} (já recebido − já pago)</dt>
          <dd className="text-right text-foreground">{formatar(numeros.real.sobra)}</dd>
          <dt>Ainda vão entrar</dt>
          <dd className="text-right text-foreground">+{formatar(p.aindaVaoEntrar)}</dd>
          <dt>Ainda vão vencer</dt>
          <dd className="text-right text-foreground">−{formatar(p.aindaVaoVencer)}</dd>
          {p.caixinhas >= 0.5 && (
            <>
              <dt>Caixinhas do ciclo</dt>
              <dd className="text-right text-foreground">−{formatar(p.caixinhas)}</dd>
            </>
          )}
          <dt className="font-semibold text-foreground">{textoVaiSobrar(numeros)}</dt>
          <dd className="text-right font-semibold text-foreground">{formatar(p.sobra)}</dd>
        </dl>
      )}
    </div>
  );
}

/**
 * Cenário pequeno: quanto sobra se o gasto no cartão seguir o ritmo do ciclo anterior. A seta abre o racional.
 */
export function CenarioRitmo({ ritmo, fim, formatar }: { ritmo: PrevisaoRitmo; fim: string; formatar: (v: number) => string }) {
  const [aberto, setAberto] = useState(false);
  if (ritmo.base === "sem dados" || ritmo.diasRestantes <= 0) return null;
  const dia = `${fim.slice(8, 10)}/${fim.slice(5, 7)}`;
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-muted-foreground">
          Pelo ritmo de gastos no cartão, sobra em {dia}{" "}
          <b className={`tabular-nums ${ritmo.sobra >= 0 ? "text-foreground" : "text-destructive"}`}>{formatar(ritmo.sobra)}</b>
        </span>
        <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aberto && (
        <p className="mt-1.5 leading-relaxed text-muted-foreground">
          {ritmo.base === "ciclo anterior"
            ? `No ciclo anterior você gastou ${formatar(ritmo.gastoBase)} em compras no cartão (sem contas fixas, boletos e parcelas já lançadas) em ${ritmo.diasBase} dias: ${formatar(ritmo.porDia)} por dia.`
            : `Ainda não há ciclo anterior com compras no cartão; usamos o ritmo deste ciclo: ${formatar(ritmo.porDia)} por dia.`}{" "}
          {`Faltam ${ritmo.diasRestantes} ${ritmo.diasRestantes === 1 ? "dia" : "dias"}: ${formatar(ritmo.porDia)} × ${ritmo.diasRestantes}`}
          {ritmo.jaLancadoDepois >= 0.5 ? ` − ${formatar(ritmo.jaLancadoDepois)} já lançados` : ""}
          {` = ${formatar(ritmo.aMais)} a mais. A linha pontilhada do gráfico mostra esse caminho.`}
        </p>
      )}
    </div>
  );
}
