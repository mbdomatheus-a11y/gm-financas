export type WidgetId =
  | "dinheiro"
  | "casa"
  | "documentos"
  | "ferramentas"
  | "atalhos"
  | "admin"
  | "conquistas"
  | "resumo";

/** p = 1 coluna, m = 2 colunas, g = linha inteira (em telas grandes). */
export type TamanhoWidget = "p" | "m" | "g";

export type ItemWidget = { id: WidgetId; tamanho: TamanhoWidget };

const ORDEM_TAMANHO: TamanhoWidget[] = ["p", "m", "g"];

export const WIDGETS: Record<
  WidgetId,
  { titulo: string; minimo: TamanhoWidget; padrao: TamanhoWidget; soAdmin?: boolean }
> = {
  dinheiro: { titulo: "Dinheiro", minimo: "p", padrao: "m" },
  casa: { titulo: "Casa e vida", minimo: "p", padrao: "m" },
  documentos: { titulo: "Documentos", minimo: "p", padrao: "m" },
  ferramentas: { titulo: "Ferramentas", minimo: "p", padrao: "m" },
  atalhos: { titulo: "Atalhos", minimo: "m", padrao: "g" },
  admin: { titulo: "Administração", minimo: "m", padrao: "g", soAdmin: true },
  conquistas: { titulo: "Metas e conquistas", minimo: "m", padrao: "g" },
  resumo: { titulo: "Resumo do mês", minimo: "g", padrao: "g" },
};

export const ORDEM_PADRAO: WidgetId[] = [
  "dinheiro",
  "casa",
  "documentos",
  "ferramentas",
  "atalhos",
  "admin",
  "conquistas",
  "resumo",
];

export function layoutAutomatico(): ItemWidget[] {
  return ORDEM_PADRAO.map((id) => ({ id, tamanho: WIDGETS[id].padrao }));
}

export function tamanhoPermitido(id: WidgetId, t: TamanhoWidget): boolean {
  return ORDEM_TAMANHO.indexOf(t) >= ORDEM_TAMANHO.indexOf(WIDGETS[id].minimo);
}

/** Aceita só o que for válido e respeita o tamanho mínimo de cada widget. */
export function normalizarLayout(bruto: unknown): ItemWidget[] {
  if (!Array.isArray(bruto)) return layoutAutomatico();
  const vistos = new Set<string>();
  const saida: ItemWidget[] = [];
  for (const x of bruto as any[]) {
    const id = x?.id as WidgetId;
    if (!(id in WIDGETS) || vistos.has(id)) continue;
    vistos.add(id);
    const t: TamanhoWidget = ["p", "m", "g"].includes(x?.tamanho) ? x.tamanho : WIDGETS[id].padrao;
    saida.push({ id, tamanho: tamanhoPermitido(id, t) ? t : WIDGETS[id].minimo });
  }
  return saida;
}

export function classeTamanho(t: TamanhoWidget): string {
  if (t === "p") return "col-span-1";
  if (t === "m") return "col-span-1 sm:col-span-2";
  return "col-span-1 sm:col-span-2 xl:col-span-4";
}
