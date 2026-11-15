// MAPA DE GASTOS EM ANÉIS (15/11/2026). ESTE ARQUIVO É IDÊNTICO no site (gm-financas/src/lib/aneis-gastos.ts)
// e no app (controlall/src/lib/aneis-gastos.ts). Sem imports, só regra e geometria.
// Centro: total do ciclo. 1º anel: categorias. 2º anel: lugares (descrições) de cada categoria.
// Faixa fina de fora: a conta ou o cartão que mais pagou aquela categoria.

export type GastoAnel = { categoria: string; rotulo?: string; chave: string; descricao: string; valor: number; conta?: string | null };

export type LugarAnel = { chave: string; descricao: string; total: number; pct: number };
export type CategoriaAnel = {
  categoria: string;
  rotulo: string;
  total: number;
  pct: number;
  /** Diferença para o ciclo anterior (positivo = gastou mais). null sem histórico. */
  delta: number | null;
  lugares: LugarAnel[];
  /** Conta ou cartão que mais pagou esta categoria. */
  conta: string | null;
  cor: string;
};

export const CORES_ANEIS = ['#2F6BFF', '#14B8A6', '#F59E0B', '#EC4899', '#8B5CF6', '#22C55E', '#EF4444', '#0EA5E9', '#A16207', '#64748B'];

/** Agrupa os gastos do ciclo em categorias e lugares. Até 8 categorias e 6 lugares por categoria; o resto vira "Outros". */
export function montarAneis(atual: GastoAnel[], anterior: GastoAnel[] = []): { total: number; categorias: CategoriaAnel[] } {
  const total = atual.reduce((s, g) => s + (g.valor > 0 ? g.valor : 0), 0);
  const antes = new Map<string, number>();
  for (const g of anterior) antes.set(g.categoria, (antes.get(g.categoria) ?? 0) + Math.max(0, g.valor));

  const porCat = new Map<string, { rotulo: string; total: number; lugares: Map<string, LugarAnel>; contas: Map<string, number> }>();
  for (const g of atual) {
    if (!(g.valor > 0)) continue;
    const cat = g.categoria || 'outros';
    const c = porCat.get(cat) ?? { rotulo: g.rotulo || cat, total: 0, lugares: new Map(), contas: new Map() };
    c.total += g.valor;
    const l = c.lugares.get(g.chave) ?? { chave: g.chave, descricao: g.descricao, total: 0, pct: 0 };
    l.total += g.valor;
    c.lugares.set(g.chave, l);
    if (g.conta) c.contas.set(g.conta, (c.contas.get(g.conta) ?? 0) + g.valor);
    porCat.set(cat, c);
  }

  let lista = [...porCat.entries()].sort((a, b) => b[1].total - a[1].total);
  if (lista.length > 8) {
    const resto = lista.slice(7);
    const outros = { rotulo: 'Outros', total: 0, lugares: new Map<string, LugarAnel>(), contas: new Map<string, number>() };
    for (const [, c] of resto) {
      outros.total += c.total;
      for (const l of c.lugares.values()) outros.lugares.set(l.chave, l);
      for (const [k, v] of c.contas) outros.contas.set(k, (outros.contas.get(k) ?? 0) + v);
    }
    lista = [...lista.slice(0, 7), ['__outros', outros]];
  }

  const categorias = lista.map(([categoria, c], i) => {
    let lugares = [...c.lugares.values()].sort((a, b) => b.total - a.total);
    if (lugares.length > 6) {
      const resto = lugares.slice(5).reduce((s, l) => s + l.total, 0);
      lugares = [...lugares.slice(0, 5), { chave: '__resto', descricao: 'Outros lugares', total: resto, pct: 0 }];
    }
    lugares = lugares.map((l) => ({ ...l, pct: c.total > 0 ? l.total / c.total : 0 }));
    const conta = [...c.contas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const anteriorCat = categoria === '__outros' ? undefined : antes.get(categoria);
    return {
      categoria,
      rotulo: c.rotulo,
      total: c.total,
      pct: total > 0 ? c.total / total : 0,
      delta: anterior.length && anteriorCat !== undefined ? c.total - anteriorCat : anterior.length ? c.total : null,
      lugares,
      conta,
      cor: CORES_ANEIS[i % CORES_ANEIS.length]!,
    };
  });
  return { total, categorias };
}

/** Caminho SVG de um pedaço de anel (ângulos em radianos, 0 = topo, sentido horário). */
export function arcoAnel(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number): string {
  const fim = a1 - a0 >= Math.PI * 2 ? a1 - 0.0001 : a1;
  const p = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  const grande = fim - a0 > Math.PI ? 1 : 0;
  return `M ${p(rOut, a0)} A ${rOut} ${rOut} 0 ${grande} 1 ${p(rOut, fim)} L ${p(rIn, fim)} A ${rIn} ${rIn} 0 ${grande} 0 ${p(rIn, a0)} Z`;
}

/** Cor mais clara (mesma família) para o segundo anel. */
export function corClara(hex: string, quanto = 0.45): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * quanto);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
