/**
 * Casa o nome de um banco cadastrado com o catálogo de logos oficiais (28/10/2026, igual ao app).
 * "Itaú 9120" acha "Itaú", "Banco do Brasil" acha "Banco do Brasil", "Caixa Econômica" acha "Caixa".
 */
export type LogoBanco = { chave: string; nome: string; logo_url: string; cor: string | null };

const RUIDO = /\b(banco|bank|s ?a|do|da|de|dos|das|financeira|pagamentos?|instituicao|ip|digital|cartoes?|cartao|br|brasil s a)\b/g;

export function chaveBanco(nome: string | null | undefined): string {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(RUIDO, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Apelidos comuns que não aparecem no nome oficial. */
const APELIDOS: Record<string, string> = { bb: "brasil", cef: "caixa", bradescard: "bradesco", itaucard: "itau", nu: "nubank" };

export function logoDoCatalogo(nome: string | null | undefined, catalogo: LogoBanco[]): string | null {
  const bruta = chaveBanco(nome);
  const primeira = bruta.split(" ")[0] ?? "";
  const k = APELIDOS[primeira] ? [APELIDOS[primeira], ...bruta.split(" ").slice(1)].join(" ") : bruta;
  if (!k || !catalogo.length) return null;
  const exato = catalogo.find((c) => c.chave === k);
  if (exato) return exato.logo_url;
  // O mais longo que é começo do nome ("itau 9120" começa com "itau"); depois o contrário.
  const prefixo = catalogo
    .filter((c) => c.chave.length >= 2 && (k === c.chave || k.startsWith(`${c.chave} `)))
    .sort((a, b) => b.chave.length - a.chave.length)[0];
  if (prefixo) return prefixo.logo_url;
  const contrario = catalogo
    .filter((c) => k.length >= 2 && c.chave.startsWith(`${k} `))
    .sort((a, b) => a.chave.length - b.chave.length)[0];
  return contrario?.logo_url ?? null;
}
