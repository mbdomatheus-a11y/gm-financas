// TEXTO NATURAL (15/11/2026). ESTE ARQUIVO É IDÊNTICO no site (gm-financas/src/lib/texto-natural.ts), no app
// (controlall/src/lib/texto-natural.ts) e copiado na Edge Function lancamento-ia. Sem imports.
// Deixa descrições escritas pela IA no português do dia a dia: primeira letra maiúscula e o resto minúsculo,
// sem perder siglas (PIX, IPVA) e nomes com mistura de caixa (iPhone, McDonald's).

const SIGLAS = new Set([
  "PIX", "IPVA", "IPTU", "IOF", "IR", "IRPF", "CDB", "CDI", "LCI", "LCA", "FGTS", "INSS", "DAS", "MEI", "DARF",
  "TV", "SUS", "CPF", "CNPJ", "NF", "NFE", "BB", "XP", "BTG", "C6", "SP", "RJ", "MG", "PR", "SC", "RS", "BA",
  "DF", "GO", "PE", "CE", "ES", "USD", "BRL", "EUA", "TI", "RH", "ONG", "IA", "PS5", "4G", "5G", "PF", "PJ",
]);

const temLetra = (p: string) => /\p{L}/u.test(p);
const soLetras = (p: string) => p.replace(/[^\p{L}\p{N}]/gu, "");
const tudoMaiusculo = (p: string) => temLetra(p) && p === p.toLocaleUpperCase("pt-BR") && p !== p.toLocaleLowerCase("pt-BR");
const comecaMaiuscula = (p: string) => {
  const c = p.match(/\p{L}/u)?.[0];
  return !!c && c === c.toLocaleUpperCase("pt-BR") && c !== c.toLocaleLowerCase("pt-BR");
};
/** iPhone, McDonald's: tem minúscula e maiúscula depois da primeira letra. */
const caixaMista = (p: string) => /\p{Ll}/u.test(p) && /\p{Lu}/u.test(p.slice(1));

export function textoNatural(texto: string | null | undefined): string {
  const s = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const palavras = s.split(" ");
  const comLetras = palavras.filter(temLetra);
  // "Mercado Do Mês": todas as palavras começando com maiúscula = título, não nome próprio.
  const titulo = comLetras.length >= 2 && comLetras.every(comecaMaiuscula) && !comLetras.every(tudoMaiusculo);
  const saida = palavras.map((p) => {
    const nucleo = soLetras(p).toLocaleUpperCase("pt-BR");
    if (SIGLAS.has(nucleo)) return p.toLocaleUpperCase("pt-BR");
    if (caixaMista(p) && !tudoMaiusculo(p)) return p;
    if (tudoMaiusculo(p) || titulo) return p.toLocaleLowerCase("pt-BR");
    return p;
  });
  const primeira = saida[0] ?? "";
  const i = primeira.search(/\p{L}/u);
  if (i >= 0 && !caixaMista(primeira)) {
    saida[0] = primeira.slice(0, i) + primeira.charAt(i).toLocaleUpperCase("pt-BR") + primeira.slice(i + 1);
  }
  return saida.join(" ");
}
