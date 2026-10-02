/**
 * Cor consistente por categoria em todos os dashboards (Bloco 3,
 * `claude/plano-mega-2026-09-14.md`): hoje a cor de cada categoria é
 * escolhida em `/categorias` (`categorias.cor`), mas cada gráfico do site
 * sorteava/repetia sua própria paleta por posição, então a mesma categoria
 * podia aparecer com cores diferentes em gráficos diferentes. Esta função
 * usa sempre a cor cadastrada como fonte única de verdade.
 *
 * Grupos que não são categoria de verdade (ex. "Fixa"/"Variável" ao
 * agrupar por tipo, "Sem responsável" ao agrupar por responsável, ou
 * "Outros grupos" quando há mais de 7 categorias no período) caem num
 * fallback determinístico: hash do nome do grupo na mesma paleta fixa já
 * usada antes, pra cor de fallback não ficar sorteando a cada render (o
 * hash depende só do texto, nunca da ordem de iteração/posição).
 */
const PALETA_FALLBACK = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.62 0.13 200)",
  "oklch(0.7 0.13 120)",
  "oklch(0.66 0.15 30)",
];

function hashIndex(texto: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h) % modulo;
}

export function criarCorPorCategoria(
  categorias: { nome: string; cor?: string | null }[] | undefined,
): (nomeCategoria: string) => string {
  const porNome = new Map<string, string>();
  for (const c of categorias ?? []) {
    if (c.cor) porNome.set(c.nome, c.cor);
  }
  return (nomeCategoria: string): string => {
    const cadastrada = porNome.get(nomeCategoria);
    if (cadastrada) return cadastrada;
    return PALETA_FALLBACK[hashIndex(nomeCategoria, PALETA_FALLBACK.length)]!;
  };
}

/**
 * Remove o sufixo " (fixa)"/" (variável)" usado por alguns gráficos (ex. o
 * "Despesas por categoria" do Dashboard) pra conseguir casar a chave do
 * grupo com o nome real da categoria cadastrada.
 */
export function nomeBaseDoGrupo(grupo: string): string {
  return grupo.replace(/ \((fixa|vari[aá]vel)\)$/i, "");
}
