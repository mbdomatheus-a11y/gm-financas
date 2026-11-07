/**
 * Catálogo de temas das caixinhas (07/11/2026). ARQUIVO COMPARTILHADO: o app tem a mesma cópia em
 * controlall/src/lib/caixinhas-temas.ts. Alterou aqui, altere lá.
 * Fotos do Unsplash por URL fixa; se não carregar, a tela mostra gradiente + ícone (campos cor1, cor2, icone).
 */
export type TemaCaixinha = {
  id: string;
  rotulo: string;
  /** Id do ícone em ICONES_CAIXINHA (usado no fallback). */
  icone: string;
  cor1: string;
  cor2: string;
  /** Id da foto no Unsplash (parte depois de "photo-"). */
  foto: string;
  /** Palavras (sem acento, minúsculas) que sugerem o tema pelo nome digitado. */
  palavras: string[];
};

export const TEMAS_CAIXINHA: TemaCaixinha[] = [
  { id: "viagem", rotulo: "Viagem", icone: "plane", cor1: "#0EA5E9", cor2: "#1670B8", foto: "1507525428034-b723cf961d3e", palavras: ["viagem", "viajar", "ferias", "passagem", "praia", "europa", "disney", "cruzeiro", "lua de mel", "turismo", "trip"] },
  { id: "casa", rotulo: "Casa", icone: "house", cor1: "#E08A00", cor2: "#EA580C", foto: "1564013799919-ab600027ffc6", palavras: ["casa", "apartamento", "apto", "imovel", "reforma", "moveis", "mudanca", "entrada", "financiamento", "aluguel"] },
  { id: "carro", rotulo: "Carro", icone: "car", cor1: "#64748B", cor2: "#334155", foto: "1494976388531-d1058494cdd8", palavras: ["carro", "moto", "veiculo", "automovel", "ipva", "seguro auto", "troca do carro"] },
  { id: "reserva", rotulo: "Reserva de emergência", icone: "shield-check", cor1: "#1C985A", cor2: "#0F766E", foto: "1579621970563-ebec7560ff3e", palavras: ["reserva", "emergencia", "imprevisto", "seguranca", "colchao"] },
  { id: "educacao", rotulo: "Educação", icone: "graduation-cap", cor1: "#6366F1", cor2: "#4338CA", foto: "1503676260728-1c00da094a0b", palavras: ["educacao", "estudo", "estudar", "curso", "faculdade", "mba", "pos", "escola", "mensalidade", "intercambio", "idioma", "ingles"] },
  { id: "casamento", rotulo: "Casamento", icone: "gem", cor1: "#D6477E", cor2: "#9D174D", foto: "1519741497674-611481863552", palavras: ["casamento", "casar", "noivado", "noiva", "festa de casamento", "bodas", "aliancas"] },
  { id: "filhos", rotulo: "Filhos", icone: "baby", cor1: "#F59E0B", cor2: "#D97706", foto: "1503454537195-1dcabb73ffb9", palavras: ["filho", "filha", "filhos", "bebe", "crianca", "enxoval", "gravidez", "maternidade", "escolinha"] },
  { id: "pet", rotulo: "Pet", icone: "paw-print", cor1: "#84CC16", cor2: "#4D7C0F", foto: "1587300003388-59208cc962cb", palavras: ["pet", "cachorro", "cao", "gato", "veterinario", "vet", "racao", "cadela"] },
  { id: "saude", rotulo: "Saúde", icone: "heart-pulse", cor1: "#DB2B33", cor2: "#9F1239", foto: "1505576399279-565b52d4ac71", palavras: ["saude", "plano de saude", "cirurgia", "dentista", "tratamento", "consulta", "academia", "terapia", "medico", "exame"] },
  { id: "presente", rotulo: "Presente", icone: "gift", cor1: "#8E5CD9", cor2: "#6D28D9", foto: "1513885535751-8b9238bd345a", palavras: ["presente", "natal", "aniversario", "surpresa", "dia das maes", "dia dos pais"] },
  { id: "tecnologia", rotulo: "Tecnologia", icone: "smartphone", cor1: "#14B8A6", cor2: "#0E7490", foto: "1518770660439-4636190af475", palavras: ["tecnologia", "notebook", "computador", "celular", "iphone", "tv", "console", "playstation", "xbox", "eletronico", "tablet", "pc", "setup"] },
  { id: "aposentadoria", rotulo: "Aposentadoria", icone: "tree-palm", cor1: "#0F766E", cor2: "#115E59", foto: "1473186578172-c141e6798cf4", palavras: ["aposentadoria", "aposentar", "previdencia", "futuro", "velhice", "independencia financeira"] },
  { id: "outro", rotulo: "Outro", icone: "piggy-bank", cor1: "#1670B8", cor2: "#1E3A8A", foto: "1554224155-6726b3ff858f", palavras: [] },
];

export const TEMA_PADRAO = "outro";

export function temaPorId(id?: string | null): TemaCaixinha {
  return TEMAS_CAIXINHA.find((t) => t.id === id) ?? TEMAS_CAIXINHA[TEMAS_CAIXINHA.length - 1]!;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Sugere o tema pelo nome digitado; null quando nada combina. */
export function sugerirTema(nome: string): string | null {
  const n = ` ${semAcento(nome)} `;
  if (n.trim().length < 3) return null;
  for (const t of TEMAS_CAIXINHA) {
    if (t.palavras.some((p) => n.includes(` ${p}`) || (p.length >= 5 && n.includes(p)))) return t.id;
  }
  return null;
}

/** URL fixa da foto padrão do tema, no tamanho pedido (largura em px). */
export function urlImagemTema(tema: TemaCaixinha, largura = 800): string {
  return `https://images.unsplash.com/photo-${tema.foto}?auto=format&fit=crop&w=${largura}&h=${Math.round(largura * 0.55)}&q=70`;
}
