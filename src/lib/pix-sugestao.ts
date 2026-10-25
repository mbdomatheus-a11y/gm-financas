/**
 * Sugestão de qual lançamento do mês um PIX importado pelo Open Finance substitui.
 * Pedido de 24/10/2026: ex. salário fixo de R$ 7.500 todo dia 15 e cai um PIX de R$ 7.952 no dia 15:
 * o site sugere trocar a receita prevista daquele mês pelo valor recebido e pergunta antes.
 * Funções puras (testadas em pix-sugestao.test.ts).
 */

export type PixItem = { id: string; data: string; valor: number; descricao: string | null };

export type Candidato = {
  id: string;
  descricao: string;
  valor: number;
  data: string; // AAAA-MM-DD
  responsavel?: string | null;
};

export type Sugestao<T extends Candidato> = { item: T; motivo: string; nota: number };

/** Diferença de valor aceita para sugerir (20%): cobre aumento, desconto e reajuste no mês. */
export const FOLGA_VALOR = 0.2;
/** Distância de datas aceita para sugerir, em dias. */
export const FOLGA_DIAS = 7;

export function normalizar(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const GENERICAS = new Set([
  "pix", "recebido", "enviado", "transferencia", "transf", "pagamento", "pagto", "credito", "debito",
  "ltda", "eireli", "me", "sa", "para", "de", "do", "da", "dos", "das", "conta", "salario",
]);

/** Palavras que identificam a pessoa ou empresa (4+ letras, sem as genéricas). */
export function palavrasChave(texto: string | null | undefined): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !GENERICAS.has(p));
}

export function diasEntre(a: string, b: string): number {
  const d1 = Date.parse(`${a.slice(0, 10)}T12:00:00Z`);
  const d2 = Date.parse(`${b.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 999;
  return Math.abs(d1 - d2) / 86400000;
}

/**
 * Nota de parecença entre o PIX e um lançamento previsto. null = não parece.
 * Valor igual, data perto e nome em comum somam pontos; longe demais em valor ou data descarta.
 */
export function notaParecenca(pix: PixItem, c: Candidato): { nota: number; motivo: string } | null {
  const valorPix = Math.abs(pix.valor);
  const valorC = Math.abs(c.valor);
  if (!valorPix || !valorC) return null;
  const difPct = Math.abs(valorPix - valorC) / valorC;
  const dias = diasEntre(pix.data, c.data);
  const palavrasPix = palavrasChave(pix.descricao);
  const nomes = [...palavrasChave(c.descricao), ...palavrasChave(c.responsavel)];
  const temNome = nomes.some((n) => palavrasPix.some((p) => p.includes(n) || n.includes(p)));

  if (difPct > FOLGA_VALOR && !temNome) return null;
  if (dias > FOLGA_DIAS && !temNome) return null;
  if (difPct > 0.5 || dias > 20) return null;

  const nota = (temNome ? 40 : 0) + (1 - difPct) * 40 + Math.max(0, FOLGA_DIAS - dias) * 3;
  const partes: string[] = [];
  partes.push(difPct < 0.005 ? "mesmo valor" : `valor ${difPct < 0.1 ? "parecido" : "próximo"}`);
  partes.push(dias < 1 ? "mesmo dia" : `${Math.round(dias)} dia${Math.round(dias) === 1 ? "" : "s"} de diferença`);
  if (temNome) partes.push("nome em comum");
  return { nota, motivo: partes.join(", ") };
}

/** Melhor candidato para o PIX, ou null quando nada parece. */
export function sugerirParaPix<T extends Candidato>(pix: PixItem, candidatos: T[]): Sugestao<T> | null {
  let melhor: Sugestao<T> | null = null;
  for (const c of candidatos) {
    const r = notaParecenca(pix, c);
    if (r && (!melhor || r.nota > melhor.nota)) melhor = { item: c, motivo: r.motivo, nota: r.nota };
  }
  return melhor;
}

/** Competência AAAA-MM de uma data. */
export function competenciaDaData(data: string): string {
  return data.slice(0, 7);
}

/** Competência anterior (AAAA-MM). */
export function competenciaAnterior(comp: string): string {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m! - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Tira prefixos de banco ("PIX RECEBIDO -", "TRANSF PIX") para sugerir uma descrição limpa. */
export function descricaoLimpa(descricao: string | null | undefined): string {
  const t = String(descricao ?? "")
    .replace(/\b(pix|transf(er[eê]ncia)?|recebid[oa]|enviad[oa]|cr[eé]dito|d[eé]bito)\b/gi, " ")
    .replace(/[-–|:*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "PIX";
  return t
    .toLowerCase()
    .replace(/(^|\s)\S/g, (s) => s.toUpperCase())
    .slice(0, 80);
}
