// MODELOS DO INÍCIO (16/11/2026). Regra pura, sem imports. CÓPIA IDÊNTICA de controlall/src/lib/modelos-inicio.ts (18/11/2026).
// Sete modelos prontos (o 7º é o Início de antes, "Original") e personalização por aba: ligar, desligar e ordenar.
// Topo fixo em todos: o "Vai sobrar" (maior número da tela) e logo abaixo Entrou e Saiu.

export type ModeloId = 'zen' | 'dia' | 'equilibrio' | 'planejador' | 'analitico' | 'completo' | 'original' | 'meu';

/** Blocos compactos novos + cartões que já existiam no Início (CartaoId do dashboard). */
export type BlocoId =
  | 'previsao-curta' | 'vencimentos' | 'hoje' | 'categorias' | 'proximo' | 'saude' | 'terminam-curto'
  | 'cartoes-curto' | 'aneis' | 'atalhos' | 'blocos' | 'contas' | 'limites' | 'jornada'
  | 'previsao' | 'caixinhas' | 'sugestoes' | 'parcelas' | 'divida' | 'fixas' | 'historico' | 'fluxo'
  | 'evolucao' | 'maiores' | 'comparativo' | 'cartoes' | 'quem' | 'andamento' | 'proximos' | 'terminam';

export const BLOCOS: { id: BlocoId; titulo: string }[] = [
  { id: 'previsao-curta', titulo: 'Previsão do ciclo (gráfico)' },
  { id: 'vencimentos', titulo: 'Vence nos próximos dias' },
  { id: 'hoje', titulo: 'Hoje' },
  { id: 'categorias', titulo: 'Despesas do mês por categoria' },
  { id: 'proximo', titulo: 'Próximo vencimento' },
  { id: 'saude', titulo: 'Saúde financeira' },
  { id: 'terminam-curto', titulo: 'Parcelas que terminam (resumo)' },
  { id: 'cartoes-curto', titulo: 'Cartões (resumo)' },
  { id: 'aneis', titulo: 'Para onde vai' },
  { id: 'atalhos', titulo: 'Atalhos' },
  { id: 'blocos', titulo: 'Blocos: saúde, limite, jornada e revisar' },
  { id: 'contas', titulo: 'Minhas contas' },
  { id: 'limites', titulo: 'Limites de gastos' },
  { id: 'jornada', titulo: 'Minha jornada' },
  { id: 'previsao', titulo: 'Previsão do mês (completa)' },
  { id: 'caixinhas', titulo: 'Caixinhas do mês' },
  { id: 'sugestoes', titulo: 'Para revisar e economizar' },
  { id: 'parcelas', titulo: 'Parcelas e dívida em aberto do mês' },
  { id: 'divida', titulo: 'Dívida em aberto' },
  { id: 'fixas', titulo: 'Fixas x variáveis' },
  { id: 'historico', titulo: 'Linha do tempo 12 meses' },
  { id: 'fluxo', titulo: 'Fluxo de caixa' },
  { id: 'evolucao', titulo: 'Evolução do saldo' },
  { id: 'maiores', titulo: 'Maiores gastos' },
  { id: 'comparativo', titulo: 'Categorias x média de 3 meses' },
  { id: 'cartoes', titulo: 'Cartões e formas de pagamento' },
  { id: 'quem', titulo: 'Quem gastou no mês' },
  { id: 'andamento', titulo: 'Parcelamentos em andamento' },
  { id: 'proximos', titulo: 'Próximos 30 dias' },
  { id: 'terminam', titulo: 'Parcelas que terminam (completo)' },
];

export type AbaModelo = { id: string; titulo: string; blocos: BlocoId[]; /** Abre a Agenda em vez de mostrar blocos. */ abreAgenda?: boolean };
export type Modelo = { id: ModeloId; nome: string; descricao: string; /** Tamanho do "Vai sobrar". */ tamanhoSobra: number; abas: AbaModelo[] };

export const MODELOS: Modelo[] = [
  { id: 'zen', nome: 'Zen', descricao: 'Só o essencial, sem abas', tamanhoSobra: 44, abas: [{ id: 'unica', titulo: '', blocos: ['previsao-curta', 'vencimentos'] }] },
  {
    id: 'dia', nome: 'Dia a dia', descricao: 'Hoje, semana e o que vence', tamanhoSobra: 36,
    abas: [
      { id: 'hoje', titulo: 'Hoje', blocos: ['hoje', 'categorias', 'proximo'] },
      { id: 'semana', titulo: 'Semana', blocos: ['proximos', 'maiores'] },
      { id: 'ciclo', titulo: 'Ciclo', blocos: ['previsao', 'fluxo'] },
      { id: 'metas', titulo: 'Metas', blocos: ['caixinhas', 'jornada'] },
    ],
  },
  {
    id: 'equilibrio', nome: 'Equilíbrio', descricao: 'Resumo, saúde e cartões', tamanhoSobra: 36,
    abas: [
      { id: 'resumo', titulo: 'Resumo', blocos: ['saude', 'terminam-curto', 'cartoes-curto'] },
      { id: 'gastos', titulo: 'Gastos', blocos: ['maiores', 'comparativo', 'quem'] },
      { id: 'contas', titulo: 'Contas', blocos: ['contas', 'cartoes', 'limites'] },
      { id: 'metas', titulo: 'Metas', blocos: ['caixinhas', 'jornada'] },
    ],
  },
  {
    id: 'planejador', nome: 'Planejador', descricao: 'Previsão e para onde vai', tamanhoSobra: 34,
    abas: [
      { id: 'ciclo', titulo: 'Ciclo', blocos: ['previsao-curta', 'aneis'] },
      { id: 'previsao', titulo: 'Previsão', blocos: ['previsao', 'evolucao'] },
      { id: 'faturas', titulo: 'Faturas', blocos: ['cartoes', 'andamento', 'proximos'] },
      { id: 'metas', titulo: 'Metas', blocos: ['caixinhas'] },
    ],
  },
  {
    id: 'analitico', nome: 'Analítico', descricao: 'Categorias e evolução', tamanhoSobra: 32,
    abas: [
      { id: 'visao', titulo: 'Visão', blocos: ['previsao-curta', 'aneis', 'saude'] },
      { id: 'categorias', titulo: 'Categorias', blocos: ['comparativo', 'fixas'] },
      { id: 'cartoes', titulo: 'Cartões', blocos: ['cartoes', 'quem'] },
      { id: 'evolucao', titulo: 'Evolução', blocos: ['historico', 'evolucao', 'fluxo'] },
    ],
  },
  {
    id: 'completo', nome: 'Completo', descricao: 'Tudo à vista, em blocos', tamanhoSobra: 30,
    abas: [
      { id: 'resumo', titulo: 'Resumo', blocos: ['atalhos', 'blocos', 'proximo'] },
      { id: 'graficos', titulo: 'Gráficos', blocos: ['previsao', 'fixas', 'historico', 'fluxo', 'evolucao'] },
      { id: 'gastos', titulo: 'Gastos', blocos: ['parcelas', 'divida', 'maiores', 'comparativo', 'cartoes', 'quem', 'andamento', 'proximos', 'terminam'] },
      { id: 'agenda', titulo: 'Agenda', blocos: [], abreAgenda: true },
    ],
  },
  { id: 'original', nome: 'Original', descricao: 'O Início de antes, sem mudanças', tamanhoSobra: 32, abas: [] },
];

export const MODELO_PADRAO: ModeloId = 'equilibrio';

/** Ajuste da pessoa numa aba: ordem dos blocos ligados (os não listados ficam desligados). */
export type AjustesInicio = Partial<Record<ModeloId, Record<string, BlocoId[]>>>;
/** 18/11/2026: UM modelo personalizado extra ("Meu modelo"), criado a partir de um modelo pronto. */
export type ModeloPersonalizado = { nome: string; base: ModeloId; abas: AbaModelo[] };
/** Foto de uma visão (para o favorito). */
export type FotoEscolha = { modelo: ModeloId; ajustes: AjustesInicio; meu: ModeloPersonalizado | null };
/** favorito: a visão marcada com estrela; "Voltar ao favorito" restaura essa foto. */
export type EscolhaInicio = FotoEscolha & { favorito: FotoEscolha | null };

export function modeloPorId(id: string | null | undefined): Modelo {
  return MODELOS.find((m) => m.id === id) ?? MODELOS.find((m) => m.id === MODELO_PADRAO)!;
}

/** Blocos ligados de uma aba, já na ordem escolhida pela pessoa (ou a do modelo). */
export function blocosDaAba(escolha: EscolhaInicio, aba: AbaModelo): BlocoId[] {
  const salvo = escolha.ajustes[escolha.modelo]?.[aba.id];
  const validos = new Set(BLOCOS.map((b) => b.id));
  return (salvo ?? aba.blocos).filter((b) => validos.has(b));
}

function lerMeu(bruto: unknown): ModeloPersonalizado | null {
  const v = (bruto && typeof bruto === 'object' ? bruto : null) as Partial<ModeloPersonalizado> | null;
  if (!v || !Array.isArray(v.abas)) return null;
  const validos = new Set(BLOCOS.map((b) => b.id));
  const abas = v.abas
    .filter((a: any) => a && typeof a.id === 'string')
    .map((a: any) => ({ id: String(a.id), titulo: String(a.titulo ?? ''), blocos: (Array.isArray(a.blocos) ? a.blocos : []).filter((b: any) => validos.has(b)), ...(a.abreAgenda ? { abreAgenda: true } : {}) }));
  const base = MODELOS.some((m) => m.id === v.base) ? (v.base as ModeloId) : MODELO_PADRAO;
  return { nome: String(v.nome ?? 'Meu modelo'), base, abas };
}

function lerFoto(bruto: unknown): FotoEscolha {
  const v = (bruto && typeof bruto === 'object' ? bruto : {}) as Partial<FotoEscolha>;
  const meu = lerMeu(v.meu);
  const valido = v.modelo === 'meu' ? !!meu : MODELOS.some((m) => m.id === v.modelo);
  const modelo = valido ? (v.modelo as ModeloId) : MODELO_PADRAO;
  const ajustes = v.ajustes && typeof v.ajustes === 'object' ? (v.ajustes as AjustesInicio) : {};
  return { modelo, ajustes, meu };
}

export function lerEscolha(bruto: unknown): EscolhaInicio {
  const v = (bruto && typeof bruto === 'object' ? bruto : {}) as Partial<EscolhaInicio>;
  return { ...lerFoto(v), favorito: v.favorito ? lerFoto(v.favorito) : null };
}

/** Modelo em uso, incluindo o "Meu modelo". */
export function modeloDaEscolha(e: Pick<EscolhaInicio, 'modelo' | 'meu'>): Modelo {
  if (e.modelo === 'meu' && e.meu) {
    return { id: 'meu', nome: e.meu.nome, descricao: 'Seu modelo personalizado', tamanhoSobra: modeloPorId(e.meu.base).tamanhoSobra, abas: e.meu.abas };
  }
  return modeloPorId(e.modelo);
}

/** Cria (ou recria) o único modelo personalizado a partir da visão atual. */
export function criarMeuModelo(e: EscolhaInicio): EscolhaInicio {
  const atual = e.modelo === 'original' ? modeloPorId(MODELO_PADRAO) : modeloDaEscolha(e);
  const abas = atual.abas.map((a) => ({ ...a, blocos: blocosDaAba(e.modelo === 'original' ? { ...e, modelo: MODELO_PADRAO } : e, a) }));
  const base = e.modelo === 'meu' && e.meu ? e.meu.base : atual.id;
  const ajustes = { ...e.ajustes };
  delete ajustes.meu;
  return { ...e, modelo: 'meu', meu: { nome: 'Meu modelo', base, abas }, ajustes };
}

function foto(e: FotoEscolha): FotoEscolha {
  return { modelo: e.modelo, ajustes: e.ajustes, meu: e.meu };
}
/** Marca a visão atual como favorita (estrela). */
export function favoritar(e: EscolhaInicio): EscolhaInicio {
  return { ...e, favorito: foto(e) };
}
export function ehFavorito(e: EscolhaInicio): boolean {
  return !!e.favorito && JSON.stringify(foto(e)) === JSON.stringify(foto(e.favorito));
}
/** Volta para a visão favorita. Sem favorito, volta ao padrão. */
export function voltarAoFavorito(e: EscolhaInicio): EscolhaInicio {
  return e.favorito ? { ...e, ...foto(e.favorito) } : { ...e, modelo: MODELO_PADRAO, ajustes: {} };
}
/** Desfaz os ajustes do modelo em uso (o "Meu modelo" volta ao que era quando foi criado). */
export function restaurarModelo(e: EscolhaInicio): EscolhaInicio {
  const ajustes = { ...e.ajustes };
  delete ajustes[e.modelo];
  return { ...e, ajustes };
}
