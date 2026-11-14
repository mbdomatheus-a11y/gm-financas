import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useDadosCiclo } from "@/hooks/useNumerosCiclo";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { buscarTaxaAnualVigente } from "@/lib/indices.functions";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { metaDoMes } from "@/lib/poupar";
import { calcularPrevisaoMes } from "@/lib/previsao-mes";
import { lerValorDigitado, PRAZOS_MESES, simularRendimento, textoPct } from "@/lib/simulador-rendimento";

const CHAVE = "controlall:simulador-indices";
type Indices = { cdi: number; selic: number; tr: number };

function lerGuardado(): Indices | null {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE) || "null");
    return j && Number.isFinite(j.cdi) && Number.isFinite(j.selic) ? { cdi: j.cdi, selic: j.selic, tr: Number(j.tr) || 0 } : null;
  } catch {
    return null;
  }
}

/** TR (SGS 226, % do período). Se indisponível, 0. */
async function buscarTR(): Promise<number> {
  try {
    const r = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.226/dados/ultimos/1?formato=json");
    const j = await r.json();
    const n = Number(String(j?.[0]?.valor).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Simulador de rendimento da sobra (17/11/2026): "Sobrou R$ X. Quanto renderia?". Só aparece com sobra prevista
 * do ciclo maior que zero. CDI e Selic do Banco Central, com o último valor guardado como reserva.
 */
export function SimuladorRendimento() {
  const prontas = useFinancasProntas();
  const { formatar } = usePrivacidadeValores("simulador-rendimento");
  const mesVigente = useCompetenciaVigente();
  const { dados, caixinhas, diaVirada } = useDadosCiclo();
  const sobra = useMemo(
    () => calcularPrevisaoMes(dados, mesVigente, metaDoMes(caixinhas, mesVigente), diaVirada).numeros.previsto.sobra,
    [dados, mesVigente, caixinhas, diaVirada],
  );
  const buscarTaxa = useServerFn(buscarTaxaAnualVigente);
  const [ind, setInd] = useState<Indices | null>(() => (typeof window === "undefined" ? null : lerGuardado()));
  const [valor, setValor] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cdi, selic, tr] = await Promise.all([buscarTaxa({ data: { indice: "CDI" } }), buscarTaxa({ data: { indice: "SELIC" } }), buscarTR()]);
        const novo = { cdi: cdi.percentualAnual, selic: selic.percentualAnual, tr };
        try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch {}
        if (vivo) setInd(novo);
      } catch {
        /* mantém o último valor guardado */
      }
    })();
    return () => { vivo = false; };
  }, [buscarTaxa]);

  const base = valor ?? Math.round(sobra * 100) / 100;
  const sim = useMemo(() => (ind ? simularRendimento(base, ind.cdi, ind.selic, ind.tr) : null), [ind, base]);

  if (!prontas || !(sobra > 0)) return null;

  function confirmar() {
    const n = lerValorDigitado(texto);
    setValor(n > 0 ? n : null);
    setEditando(false);
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
          <span>Sobrou</span>
          {editando ? (
            <input
              autoFocus
              inputMode="decimal"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={confirmar}
              onKeyDown={(e) => e.key === "Enter" && confirmar()}
              aria-label="Valor da sobra"
              className="w-28 rounded-md border border-border bg-background px-2 py-0.5 text-sm tabular-nums"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setTexto(String(base).replace(".", ",")); setEditando(true); }}
              className="rounded-md bg-primary/10 px-2 py-0.5 tabular-nums text-primary hover:bg-primary/15"
              aria-label="Editar o valor da sobra"
            >
              {formatar(base)}
            </button>
          )}
          <span>. Quanto renderia?</span>
        </div>

        {sim && ind ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px] text-right text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-1 text-left font-medium" />
                    {PRAZOS_MESES.map((m) => <th key={m} className="pb-1 font-medium">{m} meses</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sim.linhas.map((l) => (
                    <tr key={l.id} className="border-t border-border/50">
                      <td className="py-1.5 text-left font-medium">{l.rotulo}</td>
                      {PRAZOS_MESES.map((m) => {
                        const melhor = sim.melhor[m] === l.id;
                        return (
                          <td key={m} className={`py-1.5 pl-2 ${melhor ? "rounded-md bg-success/10" : ""}`}>
                            <div className={`font-semibold tabular-nums ${melhor ? "text-success" : ""}`}>{formatar(l.prazos[m].final)}</div>
                            <div className="text-[11px] tabular-nums text-muted-foreground">+{formatar(l.prazos[m].ganho)}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Simulação com CDI de {textoPct(ind.cdi)} e Selic de {textoPct(ind.selic)} ao ano, sem garantia de rentabilidade. Não é recomendação de investimento.
              </span>
              <Link to="/caixinhas" className="shrink-0 font-medium text-primary hover:underline">Guardar numa caixinha</Link>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Carregando as taxas do Banco Central...</p>
        )}
      </CardContent>
    </Card>
  );
}
