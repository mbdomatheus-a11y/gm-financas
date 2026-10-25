/**
 * O Supabase devolve no máximo 1.000 linhas por consulta. Com mais lançamentos que isso, as
 * compras mais antigas sumiam das telas (25/10/2026). Busca em páginas de 1.000 até acabar.
 * `montar` recria a consulta a cada página; ela precisa ter ordem estável (inclua .order("id")).
 */
export async function buscarTudo<T = any>(montar: () => any, passo = 1000): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += passo) {
    const { data, error } = await montar().range(de, de + passo - 1);
    if (error) throw error;
    const pagina = (data ?? []) as T[];
    todos.push(...pagina);
    if (pagina.length < passo) break;
  }
  return todos;
}
