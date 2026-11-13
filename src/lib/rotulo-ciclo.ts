import { diaViradaDefinida, viradaDoGrupo } from './format';
import { janelasDoCiclo } from './numeros-ciclo';

/**
 * Nome do ciclo (13/11/2026), igual ao app (controlall/src/lib/rotulo-ciclo.ts). Só rótulo: a chave interna
 * "AAAA-MM" continua a mesma. O ciclo é chamado pelo mês em que TERMINA, como o usuário fala:
 * virada 15, chave "2026-10" = 16/out a 15/nov = "Ciclo de novembro".
 */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function viradaAtual(diaVirada?: number | null): number | null {
  if (diaVirada !== undefined) return diaVirada;
  return viradaDoGrupo() ?? diaViradaDefinida();
}

/** "Ciclo de novembro" (com o ano quando não é o ano de hoje: "Ciclo de janeiro de 2027"). */
export function nomeDoCiclo(mes: string, diaVirada?: number | null, hoje: Date = new Date()): string {
  if (!/^\d{4}-\d{2}$/.test(String(mes ?? ''))) return String(mes ?? '');
  const j = janelasDoCiclo(mes, viradaAtual(diaVirada));
  const ano = Number(j.fim.slice(0, 4));
  const nome = MESES[Number(j.fim.slice(5, 7)) - 1] ?? j.fim.slice(5, 7);
  return `Ciclo de ${nome}${ano !== hoje.getFullYear() ? ` de ${ano}` : ''}`;
}

/** "Ciclo de novembro · 16/out a 15/nov". */
export function rotuloDoCiclo(mes: string, diaVirada?: number | null, hoje: Date = new Date()): string {
  if (!/^\d{4}-\d{2}$/.test(String(mes ?? ''))) return String(mes ?? '');
  const j = janelasDoCiclo(mes, viradaAtual(diaVirada));
  return `${nomeDoCiclo(mes, diaVirada, hoje)} · ${j.rotulo}`;
}
