// Opções do gráfico da Início, separadas de GraficoHome para o recharts poder carregar sob demanda.
export type OpcaoGrafico = "fluxo" | "saldo" | "categorias";

export const OPCOES_GRAFICO: { value: OpcaoGrafico; label: string }[] = [
  { value: "fluxo", label: "Receitas x despesas (3 meses)" },
  { value: "saldo", label: "Saldo por mês (3 meses)" },
  { value: "categorias", label: "Despesas por categoria (mês atual)" },
];

export function opcaoGraficoValida(v: unknown): OpcaoGrafico {
  return OPCOES_GRAFICO.some((o) => o.value === v) ? (v as OpcaoGrafico) : "fluxo";
}
