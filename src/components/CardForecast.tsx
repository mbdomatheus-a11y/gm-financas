import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  Calendar,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { monthLabelLong } from "@/lib/format";

interface CardForecastProps {
  mesAtual: string; // "YYYY-MM"
  totalReceitas: number;
  totalDespesas: number;
  fixas: number;
  variaveis: number;
  saldoAtual: number;
}

export function CardForecast({
  mesAtual,
  totalReceitas,
  totalDespesas,
  fixas,
  variaveis,
  saldoAtual,
}: CardForecastProps) {
  const { formatar } = usePrivacidadeValores();

  const forecast = useMemo(() => {
    const hoje = new Date();
    const [anoStr, mesStr] = mesAtual.split("-");
    const ano = Number(anoStr) || hoje.getFullYear();
    const mes = Number(mesStr) || hoje.getMonth() + 1;
    const totalDiasMes = new Date(ano, mes, 0).getDate();

    const ehMesVigente = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
    const mesPassado =
      !ehMesVigente &&
      (hoje.getFullYear() > ano ||
        (hoje.getFullYear() === ano && hoje.getMonth() + 1 > mes));
    const mesFuturo = !ehMesVigente && !mesPassado;

    const diaAtual = ehMesVigente
      ? hoje.getDate()
      : mesPassado
        ? totalDiasMes
        : 1;

    const diasCorridos = Math.max(1, diaAtual);
    const diasRestantes = ehMesVigente
      ? Math.max(0, totalDiasMes - diaAtual)
      : mesPassado
        ? 0
        : totalDiasMes;

    const pctMesDecorrido = Math.min(100, Math.round((diasCorridos / totalDiasMes) * 100));
    const pctReceitaGasta =
      totalReceitas > 0 ? Math.min(100, Math.round((totalDespesas / totalReceitas) * 100)) : 0;

    // Ritmo diário atual de gastos variáveis
    const ritmoDiarioVariavel = variaveis / diasCorridos;
    const ritmoDiarioTotal = totalDespesas / diasCorridos;

    // Projeção ao final do mês
    const estimativaVariaveisRestantes =
      ehMesVigente && diasRestantes > 0 ? ritmoDiarioVariavel * diasRestantes : 0;
    const despesasProjetadasFinal = ehMesVigente
      ? totalDespesas + estimativaVariaveisRestantes
      : totalDespesas;
    const saldoProjetadoFinal = totalReceitas - despesasProjetadasFinal;

    // Teto diário seguro restante para não estourar o orçamento
    const tetoDiarioSeguro =
      diasRestantes > 0 && saldoAtual > 0 ? saldoAtual / diasRestantes : 0;

    // Status / Semáforo
    let status: "seguro" | "atencao" | "alerta" | "neutro" = "seguro";
    let statusTexto = "No ritmo ideal para fechar o mês no azul.";
    let tomBadge: "default" | "secondary" | "destructive" = "secondary";

    if (totalReceitas <= 0) {
      status = "neutro";
      statusTexto = "Cadastre as receitas previstas deste mês para calibrar a projeção.";
      tomBadge = "secondary";
    } else if (saldoAtual < 0) {
      status = "alerta";
      statusTexto = "Orçamento já superado. Evite novos gastos variáveis.";
      tomBadge = "destructive";
    } else if (ehMesVigente && saldoProjetadoFinal < 0) {
      status = "alerta";
      statusTexto = `Ritmo diário de gastos (${formatar(ritmoDiarioVariavel)}/dia) projeta déficit ao fim do mês. Reduza gastos.`;
      tomBadge = "destructive";
    } else if (ehMesVigente && saldoProjetadoFinal < totalReceitas * 0.08) {
      status = "atencao";
      statusTexto = "Margem de folga apertada. Mantenha os gastos dentro do teto seguro diário.";
      tomBadge = "secondary";
    } else {
      status = "seguro";
      statusTexto = `Mantendo esse ritmo, você fecha com sobra estimada de ${formatar(saldoProjetadoFinal)}.`;
      tomBadge = "default";
    }

    return {
      totalDiasMes,
      diaAtual,
      diasCorridos,
      diasRestantes,
      pctMesDecorrido,
      pctReceitaGasta,
      ritmoDiarioVariavel,
      ritmoDiarioTotal,
      despesasProjetadasFinal,
      saldoProjetadoFinal,
      tetoDiarioSeguro,
      ehMesVigente,
      mesPassado,
      mesFuturo,
      status,
      statusTexto,
      tomBadge,
    };
  }, [mesAtual, totalReceitas, totalDespesas, fixas, variaveis, saldoAtual, formatar]);

  return (
    <Card className="mt-4 overflow-hidden border-primary/20 bg-gradient-to-b from-card via-card to-muted/20 shadow-sm">
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold tracking-tight">
              Forecast & Previsão de Fechamento
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {monthLabelLong(mesAtual)} · {forecast.ehMesVigente ? `Dia ${forecast.diaAtual} de ${forecast.totalDiasMes} (${forecast.diasRestantes} dias restantes)` : "Competência fechada ou futura"}
            </p>
          </div>
        </div>

        <Badge
          variant={forecast.tomBadge}
          className={`h-6 gap-1 text-xs px-2.5 font-medium ${
            forecast.status === "seguro"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              : forecast.status === "atencao"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : forecast.status === "alerta"
                  ? "bg-destructive/15 text-destructive border-destructive/30"
                  : ""
          }`}
        >
          {forecast.status === "seguro" && <CheckCircle2 className="size-3.5" />}
          {forecast.status === "atencao" && <AlertTriangle className="size-3.5" />}
          {forecast.status === "alerta" && <TrendingDown className="size-3.5" />}
          {forecast.status === "neutro" && <HelpCircle className="size-3.5" />}
          {forecast.status === "seguro"
            ? "Dentro da meta"
            : forecast.status === "atencao"
              ? "Atenção ao ritmo"
              : forecast.status === "alerta"
                ? "Risco de déficit"
                : "Sem receita informada"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Grid com indicadores principais */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Teto Diário Seguro */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Teto diário seguro</span>
              <Calendar className="size-3.5 text-primary" />
            </div>
            <p className="text-lg font-bold tracking-tight text-primary">
              {formatar(forecast.tetoDiarioSeguro)}
              <span className="text-xs font-normal text-muted-foreground">/dia</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {forecast.diasRestantes > 0
                ? `Para não estourar em ${forecast.diasRestantes} dias restantes`
                : "Mês encerrado para novos limites"}
            </p>
          </div>

          {/* Card 2: Ritmo Diário Atual */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Ritmo diário atual</span>
              <TrendingUp className="size-3.5 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold tracking-tight">
              {formatar(forecast.ritmoDiarioVariavel)}
              <span className="text-xs font-normal text-muted-foreground">/dia</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Média de variáveis nos primeiros {forecast.diasCorridos} dias
            </p>
          </div>

          {/* Card 3: Projeção de Fechamento */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Sobra projetada no fim</span>
              <ArrowDownRight className="size-3.5 text-muted-foreground" />
            </div>
            <p
              className={`text-lg font-bold tracking-tight ${
                forecast.saldoProjetadoFinal >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {formatar(forecast.saldoProjetadoFinal)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Despesas estimadas: {formatar(forecast.despesasProjetadasFinal)}
            </p>
          </div>

          {/* Card 4: Ritmo de Consumo */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Consumo do orçamento</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {forecast.pctReceitaGasta}%
              </span>
            </div>
            <Progress value={forecast.pctReceitaGasta} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{forecast.pctMesDecorrido}% do mês transcorrido</span>
              <span>{formatar(totalDespesas)} gastos</span>
            </div>
          </div>
        </div>

        {/* Linha explicativa amigável */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <p className="flex-1">{forecast.statusTexto}</p>
        </div>
      </CardContent>
    </Card>
  );
}
