/**
 * Macro categorias e subcategorias (2026-10-11).
 *
 * Modelo: a macro (ex.: "Pets") agrupa subcategorias (ex.: "Veterinário").
 * Dados vêm de três fontes:
 *  - categorias_padrao: macros e subcategorias padrão do site (admin);
 *  - subcategorias: subcategorias criadas pelos usuários, ligadas a uma macro;
 *  - categorias: macros criadas pelos usuários. Nomes antigos no formato
 *    "Macro - Sub" (ex.: "Pets - Veterinário") são lidos como subcategoria
 *    da macro "Pets", sem precisar migrar os dados.
 */

export type MacroEstrutura = { macro: string; subcategorias: string[] };

export type EntradaPadrao = { nome: string; subcategorias: string[] };
export type EntradaCategoria = { nome: string };
export type EntradaSubcategoria = { categoria: string; nome: string };

const SEP_TRACO = " - ";
const SEP_BARRA = " / ";

function limpar(t: string | null | undefined): string {
  return String(t ?? "").replace(/\s+/g, " ").trim();
}

/** Nome "Macro - Sub" (formato antigo) tem separador de traço. */
export function ehNomeLegadoComSub(nome: string): boolean {
  return limpar(nome).includes(SEP_TRACO);
}

/** Separa "Macro - Sub" em macro e subcategoria. Sem traço, a macro é o próprio nome. */
export function separarNomeLegado(nome: string): { macro: string; sub: string | null } {
  const n = limpar(nome);
  const i = n.indexOf(SEP_TRACO);
  if (i > 0) return { macro: n.slice(0, i).trim(), sub: n.slice(i + SEP_TRACO.length).trim() || null };
  return { macro: n, sub: null };
}

function chave(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Monta a estrutura completa para telas e seletores. Macros e subs ficam em ordem alfabética. */
export function montarEstrutura(opts: {
  padrao: EntradaPadrao[];
  categorias: EntradaCategoria[];
  subcategorias: EntradaSubcategoria[];
}): MacroEstrutura[] {
  const macros = new Map<string, { nome: string; subs: Map<string, string> }>();
  const garantir = (nome: string) => {
    const n = limpar(nome);
    if (!n) return null;
    const k = chave(n);
    if (!macros.has(k)) macros.set(k, { nome: n, subs: new Map() });
    return macros.get(k)!;
  };
  const addSub = (macro: string, sub: string) => {
    const m = garantir(macro);
    const s = limpar(sub);
    if (m && s) m.subs.set(chave(s), s);
  };

  for (const p of opts.padrao) {
    garantir(p.nome);
    for (const s of p.subcategorias) addSub(p.nome, s);
  }
  for (const c of opts.categorias) {
    const { macro, sub } = separarNomeLegado(c.nome);
    if (!macro) continue;
    garantir(macro);
    if (sub) addSub(macro, sub);
  }
  for (const s of opts.subcategorias) addSub(s.categoria, s.nome);

  return [...macros.values()]
    .map((m) => ({
      macro: m.nome,
      subcategorias: [...m.subs.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    }))
    .sort((a, b) => a.macro.localeCompare(b.macro, "pt-BR"));
}

/**
 * Macro de um lançamento, para agrupar gráficos e totais.
 * "Pets - Veterinário" vira "Pets"; "Moradia / Casa" continua "Moradia / Casa"
 * porque é a própria macro cadastrada.
 */
export function macroDe(nome: string | null | undefined, macros: Set<string>): string {
  const n = limpar(nome);
  if (!n) return "Outros";
  const porChave = new Map([...macros].map((m) => [chave(m), m]));
  if (porChave.has(chave(n))) return porChave.get(chave(n))!;
  for (const sep of [SEP_TRACO, SEP_BARRA]) {
    const i = n.indexOf(sep);
    if (i > 0) {
      const pref = porChave.get(chave(n.slice(0, i).trim()));
      if (pref) return pref;
    }
  }
  return n;
}

/** Subcategoria de um nome legado "Macro - Sub" quando a macro for a informada. */
export function subDe(nome: string | null | undefined, macro: string): string | null {
  const n = limpar(nome);
  const i = n.indexOf(SEP_TRACO);
  if (i > 0 && chave(n.slice(0, i).trim()) === chave(macro)) return n.slice(i + SEP_TRACO.length).trim() || null;
  return null;
}

/** Texto completo para busca e exibição: "Pets › Veterinário". */
export function rotuloCompleto(macro: string, sub: string | null): string {
  return sub ? `${macro} › ${sub}` : macro;
}

export type ModoExibicao = "categoria" | "subcategoria" | "completo";

/**
 * Nome exibido para um lançamento conforme a escolha do usuário:
 * "categoria" mostra só a macro, "subcategoria" só a sub (ou a macro se não houver),
 * "completo" mostra "Macro › Sub".
 */
export function rotuloExibicao(macro: string, sub: string | null | undefined, modo: ModoExibicao): string {
  if (modo === "subcategoria") return sub || macro;
  if (modo === "completo") return sub ? `${macro} › ${sub}` : macro;
  return macro;
}
