// NAVEGAÇÃO ÚNICA do Control ALL (14/11/2026). ESTE ARQUIVO É IDÊNTICO no site (gm-financas/src/lib/navegacao.ts)
// e no app (controlall/src/lib/navegacao.ts). Sem imports, só dados. Edite nos dois e rode scripts/checar-navegacao.mjs
// no app. Ver docs/navegacao.md.

export type GrupoNavId = 'inicio' | 'financas' | 'casa' | 'documentos' | 'ferramentas' | 'geral' | 'config' | 'admin';
export type ModuloGlobalNav = 'financas' | 'lista' | 'notas' | 'calculadora' | 'pet' | 'onde_esta' | 'veiculo' | 'exames' | 'links' | 'open_finance';
export type PermNav = 'receitas' | 'despesas' | 'cartoes' | 'investimentos' | 'veiculos' | 'compartilhar' | 'importar';

export type ItemNav = {
  id: string;
  /** Nome no menu E título da tela (padrão único). */
  titulo: string;
  grupo: GrupoNavId;
  /** Rota no site (ausente = só existe no app). */
  site?: string;
  /** Rota no app (ausente = só existe no site). */
  app?: string;
  /** Ícone do site (nome do lucide-react). */
  iconeSite: string;
  /** Ícone do app (SF Symbols). */
  iconeApp: string;
  global?: ModuloGlobalNav;
  perm?: PermNav;
  soAdmin?: boolean;
  grupoAdmin?: boolean;
};

export const GRUPOS_NAV: { id: GrupoNavId; titulo: string | null }[] = [
  { id: 'inicio', titulo: null },
  { id: 'financas', titulo: 'Finanças' },
  { id: 'casa', titulo: 'Casa e vida' },
  { id: 'documentos', titulo: 'Documentos' },
  { id: 'ferramentas', titulo: 'Ferramentas' },
  { id: 'geral', titulo: 'Geral' },
  { id: 'config', titulo: null },
  { id: 'admin', titulo: 'Administração' },
];

export const ITENS_NAV: ItemNav[] = [
  { id: 'inicio', titulo: 'Início', grupo: 'inicio', site: '/inicio', app: '/', iconeSite: 'Home', iconeApp: 'house.fill' },
  { id: 'agenda', titulo: 'Agenda', grupo: 'inicio', site: '/calendario', app: '/calendario', iconeSite: 'CalendarDays', iconeApp: 'calendar', global: 'financas' },

  { id: 'lancamentos', titulo: 'Lançamentos', grupo: 'financas', app: '/explore', iconeSite: 'ListChecks', iconeApp: 'list.bullet.rectangle.fill', global: 'financas' },
  { id: 'receitas', titulo: 'Receitas', grupo: 'financas', site: '/receitas', app: '/mais/receitas', iconeSite: 'TrendingUp', iconeApp: 'arrow.down.circle.fill', global: 'financas', perm: 'receitas' },
  { id: 'despesas', titulo: 'Despesas', grupo: 'financas', site: '/despesas', app: '/mais/despesas', iconeSite: 'TrendingDown', iconeApp: 'cart.fill', global: 'financas', perm: 'despesas' },
  { id: 'cartoes', titulo: 'Cartões/Conta', grupo: 'financas', site: '/cartoes', app: '/mais/cartoes', iconeSite: 'CreditCard', iconeApp: 'creditcard.fill', global: 'financas', perm: 'cartoes' },
  { id: 'caixinhas', titulo: 'Caixinhas e metas', grupo: 'financas', site: '/caixinhas', app: '/mais/poupar', iconeSite: 'PiggyBank', iconeApp: 'banknote.fill', global: 'financas' },
  { id: 'limites', titulo: 'Limites de gastos', grupo: 'financas', site: '/limites', app: '/mais/limites', iconeSite: 'Gauge', iconeApp: 'slider.horizontal.3', global: 'financas', perm: 'despesas' },
  { id: 'relatorios', titulo: 'Relatórios', grupo: 'financas', site: '/relatorios', app: '/mais/relatorios', iconeSite: 'BarChart3', iconeApp: 'chart.bar.fill', global: 'financas', perm: 'despesas' },
  { id: 'para-onde-vai', titulo: 'Para onde vai', grupo: 'financas', site: '/para-onde-vai', app: '/mais/para-onde-vai', iconeSite: 'PieChart', iconeApp: 'chart.pie.fill', global: 'financas', perm: 'despesas' },
  { id: 'investimentos', titulo: 'Investimentos', grupo: 'financas', site: '/investimentos', app: '/mais/investimentos', iconeSite: 'LineChart', iconeApp: 'chart.line.uptrend.xyaxis', global: 'financas', perm: 'investimentos' },
  { id: 'indices', titulo: 'Indicadores econômicos', grupo: 'financas', app: '/mais/indices', iconeSite: 'TrendingUp', iconeApp: 'chart.line.uptrend.xyaxis' },
  { id: 'importar', titulo: 'Importar faturas', grupo: 'financas', site: '/importar', app: '/mais/faturas', iconeSite: 'FileUp', iconeApp: 'doc.richtext.fill', global: 'financas', perm: 'importar' },
  { id: 'categorias', titulo: 'Categorias', grupo: 'financas', site: '/categorias', app: '/mais/categorias', iconeSite: 'Tags', iconeApp: 'tag.fill', global: 'financas' },
  { id: 'tags', titulo: 'Tags', grupo: 'financas', site: '/tags', app: '/mais/tags', iconeSite: 'Hash', iconeApp: 'tag', global: 'financas', perm: 'despesas' },
  { id: 'de-para', titulo: 'De-para', grupo: 'financas', site: '/de-para', app: '/mais/de-para', iconeSite: 'ArrowLeftRight', iconeApp: 'arrow.triangle.branch', global: 'financas', perm: 'despesas' },

  { id: 'lista', titulo: 'Lista', grupo: 'casa', site: '/lista-compras', app: '/lista', iconeSite: 'ShoppingCart', iconeApp: 'list.bullet.clipboard.fill', global: 'lista' },
  { id: 'veiculo', titulo: 'Veículo', grupo: 'casa', site: '/veiculos', app: '/mais/veiculos', iconeSite: 'Car', iconeApp: 'car.fill', global: 'veiculo', perm: 'veiculos' },
  { id: 'pet', titulo: 'Pet', grupo: 'casa', site: '/pets', app: '/mais/pets', iconeSite: 'PawPrint', iconeApp: 'pawprint.fill', global: 'pet' },
  { id: 'exames', titulo: 'Exames', grupo: 'casa', site: '/exames', app: '/mais/exames', iconeSite: 'FileHeart', iconeApp: 'cross.case.fill', global: 'exames' },
  { id: 'onde-esta', titulo: 'Onde está', grupo: 'casa', site: '/onde-esta', app: '/mais/onde-esta', iconeSite: 'MapPin', iconeApp: 'mappin.circle.fill', global: 'onde_esta' },

  { id: 'notas', titulo: 'Notas fiscais', grupo: 'documentos', site: '/notas', app: '/notas', iconeSite: 'ReceiptText', iconeApp: 'doc.text.fill', global: 'notas' },
  { id: 'links', titulo: 'Links/Anotações', grupo: 'documentos', site: '/links', app: '/mais/links', iconeSite: 'Link2', iconeApp: 'link', global: 'links' },

  { id: 'ferramentas', titulo: 'Ferramentas', grupo: 'ferramentas', site: '/ferramentas', app: '/mais/ferramentas', iconeSite: 'Calculator', iconeApp: 'plus.forwardslash.minus', global: 'calculadora' },
  { id: 'link-temporario', titulo: 'Link temporário', grupo: 'ferramentas', site: '/links-temporarios', iconeSite: 'Link2', iconeApp: 'link', global: 'calculadora' },

  { id: 'indicar', titulo: 'Indicar o Control ALL', grupo: 'geral', site: '/compartilhar', app: '/mais/compartilhar', iconeSite: 'Share2', iconeApp: 'square.and.arrow.up', perm: 'compartilhar' },
  { id: 'notificacoes', titulo: 'Notificações', grupo: 'geral', site: '/notificacoes', app: '/mais/notificacoes', iconeSite: 'BellRing', iconeApp: 'bell.fill' },
  { id: 'avisos', titulo: 'Avisos', grupo: 'geral', app: '/mais/avisos', iconeSite: 'BellRing', iconeApp: 'megaphone.fill' },
  { id: 'ajuda', titulo: 'Ajuda', grupo: 'geral', site: '/ajuda', app: '/mais/ajuda', iconeSite: 'LifeBuoy', iconeApp: 'lightbulb.fill' },
  { id: 'novidades', titulo: 'Novidades', grupo: 'geral', site: '/novidades', app: '/mais/novidades', iconeSite: 'Sparkles', iconeApp: 'sparkles' },

  { id: 'configuracoes', titulo: 'Configurações', grupo: 'config', site: '/configuracoes', app: '/mais/configuracoes', iconeSite: 'Settings', iconeApp: 'gearshape.fill' },

  { id: 'administracao', titulo: 'Administração', grupo: 'admin', site: '/administracao', iconeSite: 'ShieldCheck', iconeApp: 'lock.shield.fill', soAdmin: true },
  { id: 'open-finance', titulo: 'Open Finance', grupo: 'admin', site: '/pluggy', app: '/mais/pluggy', iconeSite: 'Landmark', iconeApp: 'link.circle.fill', global: 'open_finance' },
];

// ---- Barra inferior contextual do app (dados) ----
// Cada área: atalhos [esquerda1, esquerda2, direita1] (o "+" fica no centro e o "Mais" no fim) e as rotas do app que pertencem a ela.
export type AreaBarraId = 'inicio' | 'financas' | 'notas' | 'agenda' | 'lista' | 'demais';
export const BARRAS_NAV: Record<AreaBarraId, [string, string, string]> = {
  inicio: ['notas', 'agenda', 'lista'],
  financas: ['inicio', 'limites', 'relatorios'],
  notas: ['inicio', 'agenda', 'lista'],
  agenda: ['inicio', 'notas', 'lista'],
  lista: ['inicio', 'notas', 'agenda'],
  demais: ['inicio', 'notas', 'lista'],
};
/** Atalhos que entram no lugar de um indisponível (módulo desligado). */
export const RESERVAS_BARRA_NAV = ['inicio', 'notas', 'agenda', 'lista'];
/** Rotas do app que, além dos itens do grupo Finanças, contam como a área Finanças. */
export const ROTAS_EXTRA_FINANCAS_NAV = ['/mais/nova-despesa', '/mais/contas'];
/** Ordem global usada para encaixar a própria tela da área na sequência do deslizar. */
const ORDEM_DESLIZAR = ['inicio', 'notas', 'agenda', 'lista', 'limites', 'relatorios', 'mais'];

export function itemNav(id: string): ItemNav | undefined {
  return ITENS_NAV.find((i) => i.id === id);
}
export function rotaAppNav(id: string): string {
  return id === 'mais' ? '/mais' : (itemNav(id)?.app ?? '/');
}

/** Área da barra contextual para uma rota do app. */
export function areaBarraNav(pathname: string): AreaBarraId {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/') return 'inicio';
  if (p.startsWith('/notas')) return 'notas';
  if (p === '/calendario' || p === '/mais/calendario') return 'agenda';
  if (p.startsWith('/lista') || p === '/mais/lista-compras') return 'lista';
  const fin = ITENS_NAV.filter((i) => i.grupo === 'financas' && i.app).map((i) => i.app as string);
  if ([...fin, ...ROTAS_EXTRA_FINANCAS_NAV].includes(p)) return 'financas';
  return 'demais';
}

/** Ordem do deslizar = ordem da barra da área (esquerda, direita, Mais); a própria tela da área entra na sua posição. */
export function sequenciaDeslizarNav(area: AreaBarraId): string[] {
  const ids = [...BARRAS_NAV[area], 'mais'];
  const proprio = area === 'inicio' ? null : area === 'financas' || area === 'demais' ? null : area;
  if (proprio) {
    const r = ORDEM_DESLIZAR.indexOf(proprio);
    const pos = ids.findIndex((i) => ORDEM_DESLIZAR.indexOf(i) > r);
    ids.splice(pos < 0 ? ids.length : pos, 0, proprio);
  } else if (area === 'inicio') ids.unshift('inicio');
  return ids.map(rotaAppNav);
}
