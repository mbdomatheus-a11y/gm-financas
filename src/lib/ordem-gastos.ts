// Ordenação dos gastos dentro de cada cartão/grupo: Data (padrão), Valor ou Nome A-Z.
export type OrdemGastos = { campo: "data" | "valor" | "nome"; asc: boolean };
export const ORDEM_GASTOS_PADRAO: OrdemGastos = { campo: "data", asc: false };

export function proximaOrdem(atual: OrdemGastos, campo: OrdemGastos["campo"]): OrdemGastos {
  if (campo === "nome") return { campo, asc: true };
  if (atual.campo === campo) return { campo, asc: !atual.asc };
  return { campo, asc: false };
}

export function ordenarGastos<T>(
  itens: T[],
  ordem: OrdemGastos,
  get: { data: (x: T) => string; valor: (x: T) => number; nome: (x: T) => string },
): T[] {
  const dir = ordem.asc ? 1 : -1;
  const porValorDesc = (a: T, b: T) => get.valor(b) - get.valor(a);
  return [...itens].sort((a, b) => {
    if (ordem.campo === "nome") {
      return get.nome(a).localeCompare(get.nome(b), "pt-BR", { sensitivity: "base" }) || porValorDesc(a, b);
    }
    if (ordem.campo === "valor") return dir * (get.valor(a) - get.valor(b)) || get.data(b).localeCompare(get.data(a));
    return dir * get.data(a).localeCompare(get.data(b)) || porValorDesc(a, b);
  });
}
