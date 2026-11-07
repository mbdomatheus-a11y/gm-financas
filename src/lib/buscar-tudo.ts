/**
 * O Supabase devolve no máximo 1.000 linhas por consulta. Com mais lançamentos que isso, as
 * compras mais antigas sumiam das telas (25/10/2026). Busca em páginas de 1.000 até acabar.
 * `montar` recria a consulta a cada página; ela precisa ter ordem estável (inclua .order("id")).
 */
export async function buscarTudo<T = any>(montar: () => any, passo = 1000, paralelo = 3): Promise<T[]> {
  const buscar = async (de: number): Promise<T[]> => {
    const { data, error } = await montar().range(de, de + passo - 1);
    if (error) throw error;
    return (data ?? []) as T[];
  };
  const todos: T[] = await buscar(0);
  // Rodada 2 (07/11/2026): a primeira página diz se há mais; as seguintes saem em paralelo (em lotes de
  // `paralelo`) em vez de uma depois da outra. Para na primeira página incompleta.
  let proxima = passo;
  let acabou = todos.length < passo;
  while (!acabou) {
    const lote = await Promise.all(Array.from({ length: paralelo }, (_, k) => buscar(proxima + k * passo)));
    for (const pagina of lote) {
      todos.push(...pagina);
      if (pagina.length < passo) acabou = true;
    }
    proxima += paralelo * passo;
  }
  return todos;
}
