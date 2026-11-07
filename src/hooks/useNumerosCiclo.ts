import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCotacao } from "@/hooks/useCotacao";
import { useCartoes, useDespesas, useFaturasMes, useInvestimentos, useReceitas } from "@/hooks/useFinance";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { calcularNumerosCiclo, type DadosCiclo, type NumerosCiclo } from "@/lib/numeros-ciclo";
import { listarCaixinhas, metaDoMes } from "@/lib/poupar";
import { movimentosDeInvestimentos } from "@/lib/regras-saldo";

/**
 * Entradas da função única de sobra (src/lib/numeros-ciclo.ts), montadas igual para toda tela.
 * Telas do site que mostram sobra usam useNumerosCiclo(mes) ou estes dados com calcularNumerosCiclo.
 */
export function useDadosCiclo() {
  const cotacao = useCotacao();
  const { data: despesas = [] } = useDespesas();
  const { data: receitas = [] } = useReceitas();
  const { data: faturas = [] } = useFaturasMes();
  const { data: cartoes = [] } = useCartoes();
  const { data: investimentos = [] } = useInvestimentos();
  const { data: caixinhas = [] } = useQuery({ queryKey: ["caixinhas"], queryFn: listarCaixinhas, retry: false });
  const { prefs } = usePreferencias();
  const movimentos = useMemo(
    () => (prefs.somar_investimentos ? movimentosDeInvestimentos(investimentos as any[]) : null),
    [prefs.somar_investimentos, investimentos],
  );
  const dados = useMemo<DadosCiclo>(
    () => ({
      despesas: despesas as any[],
      receitas: receitas as any[],
      faturas: faturas as any[],
      cotacao,
      cartoes: cartoes as any[],
      mostrarFaturaAberta: prefs.mostrar_fatura_aberta,
      somarPagamentoFatura: prefs.somar_pagamento_fatura,
      movimentosInvestimento: movimentos,
    }),
    [despesas, receitas, faturas, cotacao, cartoes, prefs.mostrar_fatura_aberta, prefs.somar_pagamento_fatura, movimentos],
  );
  return { dados, caixinhas, diaVirada: prefs.dia_virada as number | null | undefined };
}

/** Números do ciclo `mes` (padrão: ciclo vigente). Sempre o mesmo cálculo, em qualquer tela. */
export function useNumerosCiclo(mesEscolhido?: string): NumerosCiclo {
  const vigente = useCompetenciaVigente();
  const mes = mesEscolhido ?? vigente;
  const { dados, caixinhas, diaVirada } = useDadosCiclo();
  return useMemo(
    () => calcularNumerosCiclo(dados, mes, metaDoMes(caixinhas, mes), diaVirada),
    [dados, mes, caixinhas, diaVirada],
  );
}
