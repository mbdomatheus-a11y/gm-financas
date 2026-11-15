// SAÚDE FINANCEIRA (15/11/2026). ESTE ARQUIVO É IDÊNTICO no site (gm-financas/src/lib/saude-financeira.ts)
// e no app (controlall/src/lib/saude-financeira.ts). Sem imports, só regra.
// Nota de 0 a 100 em 5 pilares de 20 pontos. Cada pilar diz o que fazer para subir. Nada é gravado,
// exceto a melhor nota (para as conquistas da Minha jornada nunca se perderem).

export type EntradasSaude = {
  /** Receitas previstas no ciclo. */
  receitasCiclo: number;
  /** Previsto para sobrar no fim do ciclo (pode ser negativo). */
  sobraPrevista: number;
  /** Despesas previstas no ciclo. */
  despesasCiclo: number;
  diasNoCiclo: number;
  /** Total guardado em caixinhas/metas. */
  guardado: number;
  /** Saldo disponível hoje (real do ciclo), se positivo conta como reserva. */
  saldoHoje: number;
  /** Contas que venceram neste ciclo até hoje, e quantas delas estão pagas. */
  contasVencidas: number;
  contasPagas: number;
  /** Uso do cartão: em aberto e soma dos limites. Sem cartão: limite 0. */
  cartaoEmAberto: number;
  cartaoLimite: number;
  /** Dias com algum registro nos últimos 14 dias. */
  diasComRegistro14: number;
};

export type PilarSaude = {
  id: 'sobra' | 'reserva' | 'contas' | 'cartao' | 'constancia';
  titulo: string;
  pontos: number;
  max: 20;
  /** O que o pilar mostra hoje. */
  texto: string;
  /** O que fazer para subir (vazio quando já está no máximo). */
  dica: string;
};

export type FaixaSaude = 'critica' | 'atencao' | 'boa' | 'otima';

export type SaudeFinanceira = {
  nota: number;
  faixa: FaixaSaude;
  rotulo: string;
  pilares: PilarSaude[];
  /** Sem dados suficientes para uma nota justa (nenhuma receita e nenhum gasto no ciclo). */
  semDados: boolean;
};

const lim = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const pts = (fracao: number) => Math.round(lim(fracao) * 20);
const real = (v: number) => 'R$ ' + Math.round(Math.max(0, v)).toLocaleString('pt-BR');

export function faixaDaNota(nota: number): { faixa: FaixaSaude; rotulo: string } {
  if (nota >= 80) return { faixa: 'otima', rotulo: 'Ótima' };
  if (nota >= 60) return { faixa: 'boa', rotulo: 'Boa' };
  if (nota >= 40) return { faixa: 'atencao', rotulo: 'Atenção' };
  return { faixa: 'critica', rotulo: 'Crítica' };
}

export function calcularSaude(e: EntradasSaude): SaudeFinanceira {
  const pilares: PilarSaude[] = [];

  // 1. Sobra: quanto sobra das entradas. Ideal 20% ou mais.
  const pctSobra = e.receitasCiclo > 0 ? e.sobraPrevista / e.receitasCiclo : e.despesasCiclo > 0 ? -1 : 0;
  const pSobra = pts(pctSobra / 0.2);
  const faltaSobra = e.receitasCiclo * 0.2 - e.sobraPrevista;
  pilares.push({
    id: 'sobra',
    titulo: 'Sobra',
    pontos: pSobra,
    max: 20,
    texto: e.receitasCiclo > 0 ? `Vai sobrar ${Math.round(pctSobra * 100)}% das entradas` : e.despesasCiclo > 0 ? 'Gastos sem nenhuma entrada no ciclo' : 'Sem entradas no ciclo',
    dica: pSobra >= 20 ? '' : e.receitasCiclo > 0 ? `Cortar ${real(faltaSobra)} leva a sobra a 20%` : 'Lance suas entradas do ciclo',
  });

  // 2. Reserva: dias de gasto cobertos pelo guardado + saldo de hoje. Ideal 30 dias.
  const gastoDia = e.diasNoCiclo > 0 ? e.despesasCiclo / e.diasNoCiclo : 0;
  const reserva = e.guardado + Math.max(0, e.saldoHoje);
  const diasReserva = gastoDia > 0 ? reserva / gastoDia : reserva > 0 ? 30 : 0;
  const pReserva = pts(diasReserva / 30);
  pilares.push({
    id: 'reserva',
    titulo: 'Reserva',
    pontos: pReserva,
    max: 20,
    texto: `Guardado cobre ${Math.floor(diasReserva)} dias dos seus gastos`,
    dica: pReserva >= 20 ? '' : gastoDia > 0 ? `Guardar ${real(gastoDia * 30 - reserva)} completa 1 mês de reserva` : 'Crie uma caixinha de reserva',
  });

  // 3. Contas em dia: contas vencidas até hoje que estão pagas. Sem contas vencidas: cheio.
  const pContas = e.contasVencidas > 0 ? pts(e.contasPagas / e.contasVencidas) : 20;
  const atrasadas = Math.max(0, e.contasVencidas - e.contasPagas);
  pilares.push({
    id: 'contas',
    titulo: 'Contas em dia',
    pontos: pContas,
    max: 20,
    texto: e.contasVencidas > 0 ? `${e.contasPagas} de ${e.contasVencidas} contas vencidas pagas` : 'Nenhuma conta vencida no ciclo',
    dica: atrasadas > 0 ? `Marque como pagas ou quite ${atrasadas} ${atrasadas === 1 ? 'conta' : 'contas'}` : '',
  });

  // 4. Uso do cartão: até 30% do limite vale o máximo; 90% ou mais vale zero.
  const uso = e.cartaoLimite > 0 ? e.cartaoEmAberto / e.cartaoLimite : 0;
  const pCartao = e.cartaoLimite > 0 ? (uso <= 0.3 ? 20 : pts((0.9 - uso) / 0.6)) : 20;
  pilares.push({
    id: 'cartao',
    titulo: 'Uso do cartão',
    pontos: pCartao,
    max: 20,
    texto: e.cartaoLimite > 0 ? `Usando ${Math.round(uso * 100)}% do limite` : 'Nenhum cartão com limite cadastrado',
    dica: pCartao >= 20 ? '' : `Abaixo de 30% do limite (${real(e.cartaoLimite * 0.3)}) a nota sobe`,
  });

  // 5. Constância: dias com registro nos últimos 14. 10 dias ou mais vale o máximo.
  const pConst = pts(e.diasComRegistro14 / 10);
  pilares.push({
    id: 'constancia',
    titulo: 'Constância',
    pontos: pConst,
    max: 20,
    texto: `${e.diasComRegistro14} dos últimos 14 dias com registro`,
    dica: pConst >= 20 ? '' : 'Lance ou confira seus gastos todos os dias',
  });

  let nota = pilares.reduce((s, p) => s + p.pontos, 0);
  // Fechar o ciclo no negativo limita a nota à faixa Crítica.
  if (e.sobraPrevista < 0) nota = Math.min(nota, 39);
  const semDados = e.receitasCiclo <= 0 && e.despesasCiclo <= 0;
  return { nota, ...faixaDaNota(nota), pilares, semDados };
}

/** Cor da faixa (mesma régua no site e no app). */
export const COR_FAIXA: Record<FaixaSaude, string> = {
  critica: '#E5484D',
  atencao: '#F5A524',
  boa: '#7CC243',
  otima: '#22A06B',
};
