import { useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";

/**
 * true quando despesas, receitas e faturas do mês já chegaram (25/10/2026).
 * Os cartões de resumo esperam por isso para não mostrar um valor parcial que muda logo depois
 * (ex.: "Sobram R$ 11 mil" virando "Faltam R$ 3 mil" quando as despesas terminam de carregar).
 * As consultas são as mesmas da tela (React Query não busca de novo).
 */
export function useFinancasProntas(): boolean {
  const d = useDespesas();
  const r = useReceitas();
  const f = useFaturasMes();
  if (d.isError || r.isError || f.isError) return true;
  return d.isSuccess && r.isSuccess && f.isSuccess;
}
