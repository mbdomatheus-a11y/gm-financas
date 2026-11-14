import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PiggyBank, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BotaoCompartilhar } from "@/components/BotaoCompartilhar";
import { Card, CardContent } from "@/components/ui/card";
import { useProfile, useSession } from "@/hooks/useAuthData";
import { useDadosCiclo } from "@/hooks/useNumerosCiclo";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { useRegraCiclo } from "@/hooks/useRegraCiclo";
import { formatBRL } from "@/lib/format";
import { calcularNumerosCiclo, cicloAnterior, detalheEconomia, economiaAcumulada, economiaDoCiclo } from "@/lib/numeros-ciclo";
import { metaDoMes } from "@/lib/poupar";
import { gravarEconomiaCiclo, listarEconomiaCiclos } from "@/lib/regra-ciclo";

/** "Já vi" deste navegador (avisos do ciclo). Falha de storage = mostra de novo, sem quebrar. */
const CHAVE_VISTOS = "avisos_vistos";
function lerVistos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_VISTOS) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function marcarVisto(chave: string) {
  try {
    localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...lerVistos().filter((x) => x !== chave), chave].slice(-50)));
  } catch {
    /* ignora */
  }
}

/**
 * Início (08/11/2026): aviso "Fulano mudou a virada para o dia N" e, a partir do dia D+1, o resultado do
 * ciclo que fechou ("Você economizou R$ X no ciclo 15/out a 15/nov") com a Economia acumulada.
 * O resultado é gravado em economia_ciclos na primeira abertura de alguém do grupo após a virada.
 * Economia NÃO entra como receita do ciclo novo.
 */
export function CicloInicio() {
  const { regra, disponivel } = useRegraCiclo();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const prontas = useFinancasProntas();
  const { dados, caixinhas } = useDadosCiclo();
  const qc = useQueryClient();
  const [vistos, setVistos] = useState<string[]>(() => lerVistos());
  const gravou = useRef<string | null>(null);

  const economia = useQuery({
    queryKey: ["economia-ciclos"],
    enabled: disponivel && !!regra,
    retry: false,
    queryFn: listarEconomiaCiclos,
  });

  const dia = regra?.dia_virada ?? null;
  const anterior = useMemo(() => (dia ? cicloAnterior(dia) : null), [dia]);
  const numeros = useMemo(
    () => (anterior && prontas ? calcularNumerosCiclo(dados, anterior.mes, metaDoMes(caixinhas as any[], anterior.mes), dia) : null),
    [anterior, prontas, dados, caixinhas, dia],
  );
  const salvo = economia.data?.lista.find((e) => e.ciclo_inicio === anterior?.inicio) ?? null;

  // Grava o ciclo fechado uma vez (upsert): quem abrir primeiro depois da virada.
  useEffect(() => {
    if (!anterior || !numeros || !numeros.encerrado || !economia.data?.disponivel || salvo) return;
    if (gravou.current === anterior.inicio) return;
    gravou.current = anterior.inicio;
    void gravarEconomiaCiclo(anterior.inicio, anterior.fim, economiaDoCiclo(numeros), (profile as any)?.grupo_id ?? null)
      .then(() => qc.invalidateQueries({ queryKey: ["economia-ciclos"] }))
      .catch(() => undefined);
  }, [anterior, numeros, economia.data, salvo, profile, qc]);

  const fechar = (chave: string) => {
    marcarVisto(chave);
    setVistos(lerVistos());
  };

  const chaveAviso = regra?.atualizado_em ? `regra:${regra.atualizado_em}` : "";
  const mostrarAviso =
    !!regra && regra.dia_anterior != null && regra.atualizado_por !== user?.id && !!chaveAviso && !vistos.includes(chaveAviso);

  const chaveEconomia = anterior ? `economia:${anterior.inicio}` : "";
  const valor = salvo ? Number(salvo.valor_centavos) / 100 : numeros ? economiaDoCiclo(numeros) : null;
  const mostrarEconomia = !!anterior && !!numeros?.encerrado && valor != null && !vistos.includes(chaveEconomia);
  const acumulada = economiaAcumulada(economia.data?.lista ?? []);

  if (!mostrarAviso && !mostrarEconomia) return null;
  return (
    <div className="space-y-3">
      {mostrarAviso && regra && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span>
              {regra.atualizado_por_nome ?? "Alguém do grupo"} mudou a virada para o dia {regra.dia_virada}.
            </span>
            <Button size="sm" variant="outline" onClick={() => fechar(chaveAviso)}>
              Entendi
            </Button>
          </CardContent>
        </Card>
      )}
      {mostrarEconomia && anterior && valor != null && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <PiggyBank className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold">
                {valor >= 0
                  ? `Você economizou ${formatBRL(valor)} no ciclo ${anterior.rotulo}`
                  : `O ciclo ${anterior.rotulo} fechou ${formatBRL(Math.abs(valor))} no vermelho`}
              </p>
              {economia.data?.disponivel && (
                <p className="text-sm text-muted-foreground">
                  Economia acumulada: <b className="tabular-nums text-foreground">{formatBRL(acumulada)}</b>
                </p>
              )}
              {numeros && (() => {
                const d = detalheEconomia(numeros, valor);
                return (
                  <p className="text-sm text-muted-foreground">
                    {formatBRL(d.caixinhas)} foram para caixinhas e {formatBRL(d.livre)} ficaram livres.
                  </p>
                );
              })()}
            </div>
            <BotaoCompartilhar
              titulo={valor >= 0 ? "Economizei no meu ciclo" : "Meu ciclo fechou"}
              arquivo="economia-ciclo"
              className="size-7 rounded-full text-muted-foreground"
              gerar={(fmt) => [
                valor >= 0 ? `Economizei ${fmt(valor)} neste ciclo` : `O ciclo fechou ${fmt(Math.abs(valor))} no vermelho`,
                `Ciclo ${anterior.rotulo}`,
                economia.data?.disponivel ? `Economia acumulada: ${fmt(acumulada)}` : "",
              ]}
            />
            <button
              type="button"
              aria-label="Fechar"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => fechar(chaveEconomia)}
            >
              <X className="size-4" />
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
