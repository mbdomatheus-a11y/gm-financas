/**
 * "Para onde vai meu dinheiro" (2026-10-10): agrupa os gastos por categoria ao
 * longo dos últimos 12 meses, encontra os gastos que se repetem todo mês
 * (assinaturas e contas fixas) e percebe quando um deles para de aparecer —
 * isso vira economia gerada, sem o usuário precisar marcar nada.
 *
 * Módulo puro: recebe os lançamentos já convertidos para reais e devolve
 * números e frases prontas. Assim dá para testar sem banco e sem tela.
 */

export type GastoMes = {
  /** Competência "AAAA-MM". */
  competencia: string;
  categoria: string;
  descricao: string;
  /** Chave do estabelecimento, já normalizada por quem chama. */
  chave: string;
  valor: number;
  despesaId: string;
  tipo?: string | null;
  /** true quando o lançamento é parte de um parcelamento (não é assinatura). */
  parcelado?: boolean;
};

export type ResumoCategoria = {
  categoria: string;
  /** Soma de todo o período analisado. */
  total: number;
  /** Média por mês nos meses em que houve gasto. */
  media: number;
  /** Quanto foi gasto no mês atual. */
  mesAtual: number;
  /** Média dos meses anteriores ao atual (base de comparação). */
  mediaAnterior: number;
  /** Variação do mês atual sobre a média anterior, em %. null sem base. */
  variacao: number | null;
  /** Participação no total do período, em %. */
  participacao: number;
  meses: number;
  itens: number;
};

function arred(v: number): number {
  return Number(v.toFixed(2));
}

export function resumirPorCategoria(
  gastos: GastoMes[],
  competenciaAtual: string,
): ResumoCategoria[] {
  const porCategoria = new Map<string, GastoMes[]>();
  for (const g of gastos) {
    const chave = g.categoria || "outros";
    if (!porCategoria.has(chave)) porCategoria.set(chave, []);
    porCategoria.get(chave)!.push(g);
  }
  const totalGeral = gastos.reduce((s, g) => s + g.valor, 0);

  const saida: ResumoCategoria[] = [];
  for (const [categoria, lista] of porCategoria) {
    const total = lista.reduce((s, g) => s + g.valor, 0);
    const meses = new Set(lista.map((g) => g.competencia));
    const mesAtual = lista
      .filter((g) => g.competencia === competenciaAtual)
      .reduce((s, g) => s + g.valor, 0);
    const anteriores = lista.filter((g) => g.competencia < competenciaAtual);
    const mesesAnteriores = new Set(anteriores.map((g) => g.competencia)).size;
    const mediaAnterior = mesesAnteriores
      ? anteriores.reduce((s, g) => s + g.valor, 0) / mesesAnteriores
      : 0;
    saida.push({
      categoria,
      total: arred(total),
      media: arred(total / Math.max(1, meses.size)),
      mesAtual: arred(mesAtual),
      mediaAnterior: arred(mediaAnterior),
      variacao: mediaAnterior > 0.005 ? arred(((mesAtual - mediaAnterior) / mediaAnterior) * 100) : null,
      participacao: totalGeral > 0 ? arred((total / totalGeral) * 100) : 0,
      meses: meses.size,
      itens: lista.length,
    });
  }
  return saida.sort((a, b) => b.total - a.total);
}

export type Recorrente = {
  chave: string;
  descricao: string;
  categoria: string;
  /** Valor típico por mês (mediana). */
  valor: number;
  /** Competências em que apareceu, em ordem. */
  competencias: string[];
  /** Última competência em que apareceu. */
  ultima: string;
  despesaId: string;
  /** Há quantos meses parou de aparecer (0 = ainda está ativo). */
  mesesSemAparecer: number;
  /** Economia já acumulada desde que parou (valor x meses sem aparecer). */
  economiaAcumulada: number;
};

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio]! : (v[meio - 1]! + v[meio]!) / 2;
}

function distanciaMeses(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by! - ay!) * 12 + (bm! - am!);
}

/**
 * Gastos que se repetem mês a mês (assinatura, plano, mensalidade). Exige pelo
 * menos `minimoMeses` competências diferentes e valores próximos entre si;
 * parcelamentos ficam de fora, porque eles terminam sozinhos.
 */
export function detectarRecorrentes(
  gastos: GastoMes[],
  competenciaAtual: string,
  opcoes: { minimoMeses?: number } = {},
): Recorrente[] {
  const minimo = opcoes.minimoMeses ?? 3;
  const porChave = new Map<string, GastoMes[]>();
  for (const g of gastos) {
    if (g.parcelado) continue;
    if (!g.chave) continue;
    if (!porChave.has(g.chave)) porChave.set(g.chave, []);
    porChave.get(g.chave)!.push(g);
  }

  const saida: Recorrente[] = [];
  for (const [chave, lista] of porChave) {
    const porMes = new Map<string, number>();
    for (const g of lista) porMes.set(g.competencia, (porMes.get(g.competencia) ?? 0) + g.valor);
    const competencias = [...porMes.keys()].sort();
    if (competencias.length < minimo) continue;

    const valores = [...porMes.values()];
    const valor = mediana(valores);
    if (valor <= 0) continue;
    // Valores muito diferentes entre si não são assinatura, são compra avulsa
    // no mesmo lugar (mercado, posto).
    const fora = valores.filter((v) => Math.abs(v - valor) > Math.max(2, valor * 0.25)).length;
    if (fora > Math.floor(valores.length / 3)) continue;

    const ultima = competencias[competencias.length - 1]!;
    const mesesSemAparecer = Math.max(0, distanciaMeses(ultima, competenciaAtual));
    const recente = lista[lista.length - 1]!;
    saida.push({
      chave,
      descricao: recente.descricao,
      categoria: recente.categoria || "outros",
      valor: arred(valor),
      competencias,
      ultima,
      despesaId: recente.despesaId,
      mesesSemAparecer,
      economiaAcumulada: arred(valor * mesesSemAparecer),
    });
  }
  return saida.sort((a, b) => b.valor - a.valor);
}

/** Assinaturas ativas: apareceram no mês atual ou no anterior. */
export function recorrentesAtivos(lista: Recorrente[]): Recorrente[] {
  return lista.filter((r) => r.mesesSemAparecer <= 1);
}

/**
 * Assinaturas que sumiram: pararam de aparecer há pelo menos um mês cheio.
 * Cada uma vira "economia gerada" enquanto não voltar.
 */
export function recorrentesEncerrados(lista: Recorrente[]): Recorrente[] {
  return lista
    .filter((r) => r.mesesSemAparecer >= 2)
    .sort((a, b) => b.economiaAcumulada - a.economiaAcumulada);
}

export type Pergunta = {
  id: string;
  texto: string;
  detalhe: string;
  categoria: string | null;
  tom: "alerta" | "atencao" | "boa";
};

/**
 * Perguntas e observações em português claro, sempre com o número que as
 * sustenta. Só entra o que for verdade pelos dados, nunca um palpite.
 */
export function gerarPerguntas(
  resumo: ResumoCategoria[],
  recorrentes: Recorrente[],
  rendaMensal: number,
  formatar: (v: number) => string,
): Pergunta[] {
  const perguntas: Pergunta[] = [];
  const ativos = recorrentesAtivos(recorrentes);
  const encerrados = recorrentesEncerrados(recorrentes);

  const maior = resumo[0];
  if (maior && maior.total > 0) {
    perguntas.push({
      id: "maior-categoria",
      texto: `${maior.categoria} leva ${maior.participacao.toFixed(0)}% de tudo que você gasta.`,
      detalhe: `São ${formatar(maior.total)} no período, uma média de ${formatar(maior.media)} por mês.`,
      categoria: maior.categoria,
      tom: maior.participacao >= 40 ? "atencao" : "alerta",
    });
  }

  const subiu = resumo
    .filter((r) => r.variacao != null && r.variacao >= 25 && r.mesAtual > 0 && r.mediaAnterior >= 20)
    .sort((a, b) => (b.variacao ?? 0) - (a.variacao ?? 0))[0];
  if (subiu) {
    perguntas.push({
      id: "subiu",
      texto: `Você gastou ${subiu.variacao!.toFixed(0)}% a mais com ${subiu.categoria} neste mês. Aconteceu algo diferente?`,
      detalhe: `${formatar(subiu.mesAtual)} neste mês, contra ${formatar(subiu.mediaAnterior)} de média nos meses anteriores.`,
      categoria: subiu.categoria,
      tom: "atencao",
    });
  }

  const caiu = resumo
    .filter((r) => r.variacao != null && r.variacao <= -25 && r.mediaAnterior >= 20)
    .sort((a, b) => (a.variacao ?? 0) - (b.variacao ?? 0))[0];
  if (caiu) {
    perguntas.push({
      id: "caiu",
      texto: `${caiu.categoria} caiu ${Math.abs(caiu.variacao!).toFixed(0)}% neste mês.`,
      detalhe: `${formatar(caiu.mesAtual)} neste mês, contra ${formatar(caiu.mediaAnterior)} de média. Dá para manter assim?`,
      categoria: caiu.categoria,
      tom: "boa",
    });
  }

  if (ativos.length) {
    const soma = ativos.reduce((s, r) => s + r.valor, 0);
    const peso = rendaMensal > 0 ? (soma / rendaMensal) * 100 : null;
    perguntas.push({
      id: "assinaturas",
      texto: `Você tem ${ativos.length} cobrança(s) que se repetem todo mês, somando ${formatar(soma)}.`,
      detalhe:
        (peso != null ? `Isso é ${peso.toFixed(0)}% da sua renda do mês. ` : "") +
        `Em um ano dá ${formatar(soma * 12)}. Você usa todas?`,
      categoria: null,
      tom: peso != null && peso >= 20 ? "atencao" : "alerta",
    });
  }

  if (encerrados.length) {
    const soma = encerrados.reduce((s, r) => s + r.economiaAcumulada, 0);
    perguntas.push({
      id: "economia",
      texto: `${encerrados.length} cobrança(s) pararam de aparecer. Isso já economizou ${formatar(soma)}.`,
      detalhe: `A maior foi ${encerrados[0]!.descricao}, de ${formatar(encerrados[0]!.valor)} por mês.`,
      categoria: null,
      tom: "boa",
    });
  }

  const pequenas = resumo.filter((r) => r.participacao < 3).length;
  if (pequenas >= 5) {
    const somaPequenas = resumo
      .filter((r) => r.participacao < 3)
      .reduce((s, r) => s + r.total, 0);
    perguntas.push({
      id: "pequenas",
      texto: `${pequenas} categorias pequenas somam ${formatar(somaPequenas)} juntas.`,
      detalhe: "Sozinha nenhuma pesa, mas somadas fazem diferença no fim do mês.",
      categoria: null,
      tom: "alerta",
    });
  }

  return perguntas;
}

export type QuadroMes = {
  competencia: string;
  total: number;
  /** Categoria que mais pesou no mês. */
  maiorCategoria: string | null;
  maiorValor: number;
  /** Participação da maior categoria no mês, em %. */
  maiorPercentual: number;
};

/** Um quadrinho por mês: quanto foi gasto e onde pesou mais. */
export function quadrosPorMes(gastos: GastoMes[], competencias: string[]): QuadroMes[] {
  return competencias.map((competencia) => {
    const doMes = gastos.filter((g) => g.competencia === competencia);
    const total = doMes.reduce((s, g) => s + g.valor, 0);
    const porCategoria = new Map<string, number>();
    for (const g of doMes) {
      const c = g.categoria || "outros";
      porCategoria.set(c, (porCategoria.get(c) ?? 0) + g.valor);
    }
    const maior = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      competencia,
      total: arred(total),
      maiorCategoria: maior?.[0] ?? null,
      maiorValor: arred(maior?.[1] ?? 0),
      maiorPercentual: total > 0 && maior ? arred((maior[1] / total) * 100) : 0,
    };
  });
}
