import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  Calendar,
  CheckCircle2,
  HelpCircle,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { monthLabelLong } from "@/lib/format";
import { useCicloVigente } from "@/lib/periodo-vigente";

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
  fixas,
  variaveis,
}: CardForecastProps) {
  const { formatar } = usePrivacidadeValores();
  const ciclo = useCicloVigente();

  const forecast = useMemo(() => {
    const hoje = new Date();
    const [anoStr, mesStr] = mesAtual.split("-");
    const ano = Number(anoStr) || hoje.getFullYear();
    const mes = Number(mesStr) || hoje.getMonth() + 1;

    const ehMesVigente = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
    const mesPassado =
      !ehMesVigente &&
      (hoje.getFullYear() > ano ||
        (hoje.getFullYear() === ano && hoje.getMonth() + 1 > mes));
    const mesFuturo = !ehMesVigente && !mesPassado;

    // Se estivermos na competência vigente, usamos os dias precisos do ciclo do admin
    const diasTotais = ehMesVigente ? ciclo.diasTotais : new Date(ano, mes, 0).getDate();
    const diasCorridos = ehMesVigente ? ciclo.diasCorridos : (mesPassado ? diasTotais : 1);
    const diasRestantes = ehMesVigente ? ciclo.diasRestantes : (mesPassado ? 0 : diasTotais);
    const diaAtualNoCiclo = ehMesVigente ? ciclo.diaAtualNoCiclo : (mesPassado ? diasTotais : 1);

    // 1. Orçamento disponível para o variável: Receita total menos compromissos fixos/parcelas contratuais
    const orcamentoVariavel = Math.max(0, totalReceitas - fixas);

    // 2. Variáveis já realizadas até o momento
    const variaveisRealizadas = Math.max(0, variaveis);

    // 3. Saldo variável livre restante no ciclo
    const saldoVariavelRestante = orcamentoVariavel - variaveisRealizadas;

    // 4. Ritmo diário atual de gastos variáveis
    const ritmoDiarioVariavel = variaveisRealizadas / diasCorridos;

    // 5. Teto diário seguro exclusivo para o variável
    const tetoDiarioSeguro =
      diasRestantes > 0 && saldoVariavelRestante > 0
        ? saldoVariavelRestante / diasRestantes
        : 0;

    // 6. Projeção de despesas variáveis ao final do ciclo
    const projecaoVariavelFinal = ehMesVigente
      ? variaveisRealizadas + (diasRestantes > 0 ? ritmoDiarioVariavel * diasRestantes : 0)
      : variaveisRealizadas;

    // 7. Sobra livre projetada após cobrir fixas e variáveis estimadas
    const sobraLivreProjetada = orcamentoVariavel - projecaoVariavelFinal;

    // Porcentagens
    const pctCicloDecorrido = Math.min(100, Math.round((diasCorridos / diasTotais) * 100));
    const pctOrcamentoVariavelGasto =
      orcamentoVariavel > 0
        ? Math.min(100, Math.round((variaveisRealizadas / orcamentoVariavel) * 100))
        : 100;

    // Status e diagnóstico financeiro inteligente
    let status: "seguro" | "atencao" | "alerta" | "neutro" = "seguro";
    let statusTexto = "";
    let tomBadge: "default" | "secondary" | "destructive" = "secondary";

    if (totalReceitas <= 0) {
      status = "neutro";
      statusTexto = "Cadastre as receitas previstas desta competência para calibrar o forecast.";
      tomBadge = "secondary";
    } else if (orcamentoVariavel <= 0) {
      status = "alerta";
      statusTexto = `Os compromissos fixos e parcelas (${formatar(fixas)}) já consomem 100% das receitas. Qualquer gasto variável gera déficit.`;
      tomBadge = "destructive";
    } else if (saldoVariavelRestante < 0) {
      status = "alerta";
      statusTexto = `O orçamento variável de ${formatar(orcamentoVariavel)} foi estourado em ${formatar(Math.abs(saldoVariavelRestante))}. Evite novos gastos variáveis.`;
      tomBadge = "destructive";
    } else if (ehMesVigente && sobraLivreProjetada < 0) {
      const excessoDiario = ritmoDiarioVariavel - tetoDiarioSeguro;
      status = "alerta";
      statusTexto = `Atenção: o ritmo diário variável (${formatar(ritmoDiarioVariavel)}/dia) supera o teto seguro de ${formatar(tetoDiarioSeguro)}/dia. Reduza cerca de ${formatar(excessoDiario)}/dia para não fechar no negativo.`;
      tomBadge = "destructive";
    } else if (ehMesVigente && sobraLivreProjetada < orcamentoVariavel * 0.1) {
      status = "atencao";
      statusTexto = `Margem de sobra livre apertada: projeção de sobra de ${formatar(sobraLivreProjetada)}. Mantenha seus gastos diários abaixo de ${formatar(tetoDiarioSeguro)}/dia.`;
      tomBadge = "secondary";
    } else {
      status = "seguro";
      statusTexto = `No ritmo ideal! Gastando em média ${formatar(ritmoDiarioVariavel)}/dia (abaixo do teto de ${formatar(tetoDiarioSeguro)}/dia), a sobra livre projetada é de ${formatar(sobraLivreProjetada)}.`;
      tomBadge = "default";
    }

    return {
      diasTotais,
      diasCorridos,
      diasRestantes,
      diaAtualNoCiclo,
      orcamentoVariavel,
      variaveisRealizadas,
      saldoVariavelRestante,
      tetoDiarioSeguro,
      ritmoDiarioVariavel,
      projecaoVariavelFinal,
      sobraLivreProjetada,
      pctCicloDecorrido,
      pctOrcamentoVariavelGasto,
      ehMesVigente,
      mesPassado,
      mesFuturo,
      status,
      statusTexto,
      tomBadge,
    };
  }, [mesAtual, totalReceitas, fixas, variaveis, ciclo, formatar]);

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
              {monthLabelLong(mesAtual)} · {forecast.ehMesVigente ? `Ciclo ${ciclo.rotuloPeriodo} (dia ${forecast.diaAtualNoCiclo} de ${forecast.diasTotais} · ${forecast.diasRestantes} dias restantes)` : "Competência de referência"}
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
                : "Sem receita cadastrada"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Faixa explicativa do isolamento das fixas */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Info className="size-3.5 text-primary" />
            <span>
              Compromissos fixos e faturas contratadas (<strong>{formatar(fixas)}</strong>) já estão garantidos e isolados do forecast.
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <span>Orçamento livre para variáveis:</span>
            <span className="text-primary font-bold">{formatar(forecast.orcamentoVariavel)}</span>
          </div>
        </div>

        {/* Grid com indicadores principais focados no variável */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Teto Diário Seguro Variável */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Teto diário seguro (variável)</span>
              <Calendar className="size-3.5 text-primary" />
            </div>
            <p className="text-lg font-bold tracking-tight text-primary">
              {formatar(forecast.tetoDiarioSeguro)}
              <span className="text-xs font-normal text-muted-foreground">/dia</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {forecast.diasRestantes > 0
                ? `Para ${forecast.diasRestantes} dias restantes (${formatar(forecast.saldoVariavelRestante)} livres)`
                : "Ciclo encerrado para novos gastos"}
            </p>
          </div>

          {/* Card 2: Ritmo Diário Atual de Variáveis */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Ritmo diário atual (variável)</span>
              <TrendingUp className="size-3.5 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold tracking-tight">
              {formatar(forecast.ritmoDiarioVariavel)}
              <span className="text-xs font-normal text-muted-foreground">/dia</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Média realizada nos primeiros {forecast.diasCorridos} dias do ciclo
            </p>
          </div>

          {/* Card 3: Sobra Livre Projetada ao Final do Ciclo */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Sobra livre estimada</span>
              <Wallet className="size-3.5 text-muted-foreground" />
            </div>
            <p
              className={`text-lg font-bold tracking-tight ${
                forecast.sobraLivreProjetada >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {formatar(forecast.sobraLivreProjetada)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Variáveis estimadas ao fim: {formatar(forecast.projecaoVariavelFinal)}
            </p>
          </div>

          {/* Card 4: Consumo do Orçamento Variável */}
          <div className="rounded-xl border bg-card/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Consumo do variável</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {forecast.pctOrcamentoVariavelGasto}%
              </span>
            </div>
            <Progress value={forecast.pctOrcamentoVariavelGasto} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{forecast.pctCicloDecorrido}% do ciclo transcorrido</span>
              <span>{formatar(forecast.variaveisRealizadas)} gastos</span>
            </div>
          </div>
        </div>

        {/* Resumo inteligente e recomendação prática */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="flex-1 leading-relaxed text-foreground">{forecast.statusTexto}</p>
        </div>
      </CardContent>
    </Card>
  );
}
