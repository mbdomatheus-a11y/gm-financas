// Nome de cartão/banco para exibir (08/11/2026): nomes digitados ou importados em CAIXA ALTA ou
// minúscula viram capitalização padrão, e as marcas conhecidas saem com a grafia oficial.
// Só muda a apresentação; o dado salvo não é alterado.

const MARCAS: [RegExp, string][] = [
  [/\bitau\b|\bita[uú]\b/i, "Itaú"],
  [/\bnu\s?bank\b|\bnubank\b/i, "Nubank"],
  [/\bsantander\b/i, "Santander"],
  [/\bbradesco\b/i, "Bradesco"],
  [/\binter\b/i, "Inter"],
  [/\bpernambucanas\b/i, "Pernambucanas"],
  [/\bc6\b/i, "C6 Bank"],
  [/\bbanco do brasil\b/i, "Banco do Brasil"],
  [/\bcaixa\b/i, "Caixa"],
  [/\bpicpay\b/i, "PicPay"],
  [/\bmercado ?pago\b/i, "Mercado Pago"],
  [/\bbtg\b/i, "BTG"],
  [/\bsicoob\b/i, "Sicoob"],
  [/\bsicredi\b/i, "Sicredi"],
  [/\bpagbank\b|\bpagseguro\b/i, "PagBank"],
  [/\bpersonnalit[eé]\b/i, "Personnalité"],
  [/\bcroma\b/i, "Croma"],
  [/\briachuelo\b/i, "Riachuelo"],
  [/\bmastercard\b/i, "Mastercard"],
  [/\bvisa\b/i, "Visa"],
  [/\belo\b/i, "Elo"],
  [/\bamex\b|\bamerican express\b/i, "American Express"],
  [/\bmult\b/i, "Mult"],
  [/\bpts\b/i, "Pts"],
];

const MINUSCULAS = new Set(["de", "da", "do", "dos", "das", "e"]);

function capitalizar(palavra: string): string {
  if (/[0-9●•]/.test(palavra)) return palavra;
  if (MINUSCULAS.has(palavra.toLowerCase())) return palavra.toLowerCase();
  return palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1).toLocaleLowerCase("pt-BR");
}

export function formatarNomeExibicao(texto: string | null | undefined): string {
  const limpo = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  const letras = limpo.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const tudoMaiusculo = letras.length > 0 && letras === letras.toLocaleUpperCase("pt-BR");
  const tudoMinusculo = letras.length > 0 && letras === letras.toLocaleLowerCase("pt-BR");
  let saida = tudoMaiusculo || tudoMinusculo
    ? limpo.split(" ").map(capitalizar).join(" ")
    : limpo;
  for (const [regex, nome] of MARCAS) saida = saida.replace(new RegExp(regex.source, "gi"), nome);
  return saida;
}
