import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRegraCiclo } from "@/hooks/useRegraCiclo";
import { cicloAtual } from "@/lib/numeros-ciclo";
import { abrirConfigurarCiclo } from "@/lib/regra-ciclo";
import { FRASE_REGRA } from "./ConfigurarCiclo";

const dataHora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

/** Configurações (08/11/2026): seção "Ciclo do mês" com a regra do grupo, quem configurou e quando. Qualquer membro altera. */
export function CicloDoMesCard({ className = "" }: { className?: string }) {
  const { disponivel, regra } = useRegraCiclo();
  if (!disponivel) return null;
  const ciclo = regra ? cicloAtual(regra.dia_virada) : null;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" /> Ciclo do mês
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {regra && ciclo ? (
          <>
            <p className="font-medium">Virada no dia {regra.dia_virada}</p>
            <p className="rounded-xl bg-muted p-3">{FRASE_REGRA(regra.dia_virada)}</p>
            <p className="text-muted-foreground">
              Receitas contam pela data prevista, de {regra.dia_virada} até {regra.dia_virada === 1 ? "o fim do mês" : `${regra.dia_virada - 1} do mês seguinte`}. Contas
              contam pelo vencimento, de {regra.dia_virada + 1} até {regra.dia_virada} do mês seguinte. Ciclo atual: {ciclo.texto}.
            </p>
            <p className="text-xs text-muted-foreground">
              Configurado por {regra.configurado_por_nome ?? "um membro do grupo"} em {dataHora(regra.configurado_em)}
              {regra.atualizado_em !== regra.configurado_em && regra.atualizado_por_nome
                ? `. Última alteração: ${regra.atualizado_por_nome} em ${dataHora(regra.atualizado_em)}`
                : ""}
              .
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">O grupo ainda não definiu o ciclo do mês.</p>
        )}
        <Button size="sm" onClick={abrirConfigurarCiclo}>
          {regra ? "Alterar" : "Configurar"}
        </Button>
      </CardContent>
    </Card>
  );
}
