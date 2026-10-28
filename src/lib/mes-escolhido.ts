/**
 * Mês escolhido pelo usuário, o mesmo em Despesas, Receitas e Calendário (28/10/2026, igual ao app).
 * Fica salvo neste navegador e vale até o mês do calendário virar (aí volta para o mês atual).
 */
const CHAVE = "control-all.mes-escolhido";

function baseAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function mesEscolhidoSite(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as { mes?: string; base?: string } | null;
    return v && v.base === baseAtual() && typeof v.mes === "string" && /^\d{4}-\d{2}$/.test(v.mes) ? v.mes : null;
  } catch {
    return null;
  }
}

export function guardarMesSite(mes: string) {
  if (!/^\d{4}-\d{2}$/.test(mes)) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ mes, base: baseAtual() }));
  } catch {
    // navegador sem armazenamento: só não lembra
  }
}
