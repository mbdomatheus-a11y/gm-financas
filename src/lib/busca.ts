export function correspondeBuscaComValor(
  textoBase: string,
  valor: number,
  busca: string,
): boolean {
  if (!busca || !busca.trim()) return true;
  const termoLower = busca.trim().toLowerCase();

  // 1. Busca por texto (descrição, categoria, responsável, etc.)
  if (textoBase.toLowerCase().includes(termoLower)) return true;

  // 2. Formatacao numerica em PT-BR e variantes
  const valNum = Number(valor);
  if (!Number.isFinite(valNum)) return false;

  const ptBrComMilhar = valNum.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }); // ex: "3.259,25" ou "259,25"
  const ptBrSemMilhar = ptBrComMilhar.replace(/\./g, ""); // ex: "3259,25"
  const rawDot = valNum.toFixed(2); // ex: "3259.25"
  const rawDotInt = valNum.toFixed(0); // ex: "3259"
  const ptBrInt = Math.floor(valNum).toLocaleString("pt-BR"); // ex: "3.259"

  const representacoes = [
    ptBrComMilhar,
    ptBrSemMilhar,
    rawDot,
    rawDotInt,
    ptBrInt,
    `r$ ${ptBrComMilhar}`,
    `r$${ptBrComMilhar}`,
    `r$ ${ptBrSemMilhar}`,
  ];

  if (representacoes.some((rep) => rep.toLowerCase().includes(termoLower))) {
    return true;
  }

  // 3. Normalização numérica da busca (para 120.00 ou R$ 3.259,25)
  const termoLimpo = termoLower.replace(/r\$\s?/g, "").trim();
  
  // Se tem vírgula, tratamos ponto como milhar e vírgula como decimal
  let buscaNormalizada = termoLimpo;
  if (termoLimpo.includes(",")) {
    buscaNormalizada = termoLimpo.replace(/\./g, "").replace(",", ".");
  }

  const valBusca = parseFloat(buscaNormalizada);
  if (!isNaN(valBusca)) {
    if (Math.abs(valNum - valBusca) < 0.001) return true;
  }

  return false;
}
