// MINHA JORNADA (15/11/2026): gamificação leve e opcional. ESTE ARQUIVO É IDÊNTICO no site
// (gm-financas/src/lib/jornada.ts) e no app (controlall/src/lib/jornada.ts). Sem imports, só regra.
// Nada é gravado a cada ação: tudo é calculado a partir do que a função minha_jornada() devolve.
// Regras: premia constância e hábito bom; nunca premia gastar; perder a sequência não tira nada.

export type JornadaBruta = {
  visivel: boolean;
  /** Dias com algum registro, 'AAAA-MM-DD', do mais recente para o mais antigo. */
  dias: string[];
  contagens: Record<string, number>;
};

export type ConquistaDef = {
  id: string;
  titulo: string;
  descricao: string;
  /** Chave em contagens, ou 'melhorSequencia'. */
  chave: string;
  alvo: number;
  exp: number;
  iconeSite: string;
  iconeApp: string;
};

export const CONQUISTAS: ConquistaDef[] = [
  { id: 'primeiro-lancamento', titulo: 'Primeiro passo', descricao: 'Registre o primeiro lançamento.', chave: 'lancamentos', alvo: 1, exp: 20, iconeSite: 'Footprints', iconeApp: 'checkmark.seal' },
  { id: 'dez-lancamentos', titulo: 'Pegando o ritmo', descricao: 'Chegue a 10 lançamentos.', chave: 'lancamentos', alvo: 10, exp: 40, iconeSite: 'ListChecks', iconeApp: 'list.bullet.rectangle.fill' },
  { id: 'cem-lancamentos', titulo: 'Tudo anotado', descricao: 'Chegue a 100 lançamentos.', chave: 'lancamentos', alvo: 100, exp: 120, iconeSite: 'BookCheck', iconeApp: 'doc.text.fill' },
  { id: 'fatura', titulo: 'Fatura na mão', descricao: 'Importe a primeira fatura.', chave: 'importacoes', alvo: 1, exp: 40, iconeSite: 'FileUp', iconeApp: 'doc.richtext.fill' },
  { id: 'caixinha', titulo: 'Primeira caixinha', descricao: 'Crie uma caixinha ou meta.', chave: 'caixinhas', alvo: 1, exp: 40, iconeSite: 'PiggyBank', iconeApp: 'banknote.fill' },
  { id: 'aportes', titulo: 'Guardando sempre', descricao: 'Faça 5 aportes nas caixinhas.', chave: 'aportes', alvo: 5, exp: 60, iconeSite: 'Coins', iconeApp: 'arrow.down.circle.fill' },
  { id: 'limite', titulo: 'Com limite', descricao: 'Defina um limite de gastos.', chave: 'limites', alvo: 1, exp: 30, iconeSite: 'Gauge', iconeApp: 'slider.horizontal.3' },
  { id: 'nota', titulo: 'Nota guardada', descricao: 'Guarde a primeira nota fiscal.', chave: 'notas', alvo: 1, exp: 30, iconeSite: 'ReceiptText', iconeApp: 'doc.text.fill' },
  { id: 'semana', titulo: 'Semana cheia', descricao: '7 dias seguidos com registro.', chave: 'melhorSequencia', alvo: 7, exp: 80, iconeSite: 'Flame', iconeApp: 'flame' },
  { id: 'mes', titulo: 'Mês inteiro', descricao: '30 dias seguidos com registro.', chave: 'melhorSequencia', alvo: 30, exp: 200, iconeSite: 'Trophy', iconeApp: 'sparkles' },
];

export const EXP_POR_DIA = 10;
const TITULOS_NIVEL = ['Começando', 'Organizado', 'Atento', 'Planejador', 'Estrategista', 'Mestre do controle'];

/** EXP total necessário para ALCANÇAR o nível n (1 = 0, 2 = 100, 3 = 300, 4 = 600, 5 = 1000...). */
export function expDoNivel(n: number): number {
  return 50 * n * (n - 1);
}
export function nivelDe(exp: number): number {
  let n = 1;
  while (exp >= expDoNivel(n + 1)) n += 1;
  return n;
}
export function tituloNivel(n: number): string {
  return TITULOS_NIVEL[Math.min(n, TITULOS_NIVEL.length) - 1] ?? 'Começando';
}

function diaAnterior(dia: string): string {
  const [a = 1970, m = 1, d = 1] = dia.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d) - 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Dia de hoje no fuso do aparelho, 'AAAA-MM-DD'. */
export function hojeLocal(agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

export type ConquistaEstado = ConquistaDef & { atual: number; feita: boolean };
export type Jornada = {
  visivel: boolean;
  exp: number;
  nivel: number;
  titulo: string;
  /** EXP já feito dentro do nível atual e quanto o nível pede. */
  expNoNivel: number;
  expDoNivelAtual: number;
  /** 0 a 1. */
  progresso: number;
  /** Dias seguidos até hoje (ou até ontem: o dia de hoje ainda pode ser registrado). */
  sequencia: number;
  melhorSequencia: number;
  registrouHoje: boolean;
  diasAtivos: number;
  conquistas: ConquistaEstado[];
  feitas: number;
};

export function calcularJornada(bruta: JornadaBruta, hoje: string = hojeLocal()): Jornada {
  const dias = Array.from(new Set(bruta.dias ?? [])).sort().reverse();
  const conjunto = new Set(dias);

  // Sequência atual: conta a partir de hoje; se hoje ainda não tem registro, a partir de ontem.
  const registrouHoje = conjunto.has(hoje);
  let cursor = registrouHoje ? hoje : diaAnterior(hoje);
  let sequencia = 0;
  while (conjunto.has(cursor)) {
    sequencia += 1;
    cursor = diaAnterior(cursor);
  }

  // Melhor sequência no período recebido.
  let melhor = 0;
  let corrida = 0;
  let anterior: string | null = null;
  for (const d of dias) {
    corrida = anterior !== null && diaAnterior(anterior) === d ? corrida + 1 : 1;
    if (corrida > melhor) melhor = corrida;
    anterior = d;
  }

  const valores: Record<string, number> = { ...(bruta.contagens ?? {}), melhorSequencia: melhor };
  const conquistas: ConquistaEstado[] = CONQUISTAS.map((c) => {
    const atual = Math.max(0, Number(valores[c.chave] ?? 0));
    return { ...c, atual: Math.min(atual, c.alvo), feita: atual >= c.alvo };
  });
  const feitas = conquistas.filter((c) => c.feita).length;

  const exp = dias.length * EXP_POR_DIA + conquistas.reduce((s, c) => s + (c.feita ? c.exp : 0), 0);
  const nivel = nivelDe(exp);
  const base = expDoNivel(nivel);
  const tamanho = expDoNivel(nivel + 1) - base;
  return {
    visivel: bruta.visivel !== false,
    exp,
    nivel,
    titulo: tituloNivel(nivel),
    expNoNivel: exp - base,
    expDoNivelAtual: tamanho,
    progresso: tamanho > 0 ? Math.min(1, (exp - base) / tamanho) : 0,
    sequencia,
    melhorSequencia: melhor,
    registrouHoje,
    diasAtivos: dias.length,
    conquistas,
    feitas,
  };
}

/** Frase curta para o cartão da Início. */
export function fraseJornada(j: Jornada): string {
  if (j.diasAtivos === 0) return 'Registre o primeiro lançamento para começar.';
  if (j.sequencia === 0) return 'Registre algo hoje e comece uma sequência nova.';
  if (!j.registrouHoje) return `${j.sequencia} ${j.sequencia === 1 ? 'dia seguido' : 'dias seguidos'}. Registre algo hoje para continuar.`;
  return `${j.sequencia} ${j.sequencia === 1 ? 'dia seguido' : 'dias seguidos'}. Volte amanhã para continuar.`;
}
