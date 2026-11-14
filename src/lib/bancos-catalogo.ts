/**
 * Catálogo de bancos e instituições (07/11/2026). Nome oficial, apelidos para casar texto livre,
 * cor da marca e domínio (o ícone vem do favicon do domínio). Mesmo arquivo no app (src/lib/bancos-catalogo.ts).
 */
export type BancoCatalogo = {
  nome: string;
  /** Variações em minúsculas e sem acento. Casam por palavra inteira ou trecho. */
  apelidos: string[];
  cor: string;
  dominio: string;
  /** Cor do texto das iniciais quando a cor da marca é clara. */
  texto?: string;
};

export const BANCOS_CATALOGO: BancoCatalogo[] = [
  { nome: "Itaú", apelidos: ["itau", "itau unibanco", "banco itau", "itaucard", "itau personnalite", "iti"], cor: "#EC7000", dominio: "itau.com.br" },
  { nome: "Santander", apelidos: ["santander", "banco santander", "santander pessoa fisica", "santander select"], cor: "#EC0000", dominio: "santander.com.br" },
  { nome: "Bradesco", apelidos: ["bradesco", "banco bradesco", "bradescard", "next bradesco"], cor: "#CC092F", dominio: "bradesco.com.br" },
  { nome: "Banco do Brasil", apelidos: ["banco do brasil", "bb", "ourocard", "bco do brasil", "bancodobrasil"], cor: "#FAE128", dominio: "bb.com.br", texto: "#0038A8" },
  { nome: "Caixa", apelidos: ["caixa", "caixa economica", "caixa economica federal", "cef"], cor: "#005CA9", dominio: "caixa.gov.br" },
  { nome: "Nubank", apelidos: ["nubank", "nu pagamentos", "nu bank", "roxinho", "nu"], cor: "#820AD1", dominio: "nubank.com.br" },
  { nome: "Inter", apelidos: ["inter", "banco inter", "inter medium"], cor: "#FF7A00", dominio: "inter.co" },
  { nome: "C6 Bank", apelidos: ["c6", "c6 bank", "banco c6"], cor: "#242424", dominio: "c6bank.com.br" },
  { nome: "BTG Pactual", apelidos: ["btg", "btg pactual", "banco btg", "banco btg pactual"], cor: "#0D2C54", dominio: "btgpactual.com" },
  { nome: "XP", apelidos: ["xp", "xp investimentos", "banco xp", "cartao xp"], cor: "#111111", dominio: "xpi.com.br" },
  { nome: "PicPay", apelidos: ["picpay", "pic pay"], cor: "#21C25E", dominio: "picpay.com" },
  { nome: "Mercado Pago", apelidos: ["mercado pago", "mercadopago", "mercado livre"], cor: "#00B1EA", dominio: "mercadopago.com.br" },
  { nome: "PagBank", apelidos: ["pagbank", "pagseguro", "pag bank", "pag seguro"], cor: "#41B563", dominio: "pagbank.com.br" },
  { nome: "Neon", apelidos: ["neon", "banco neon"], cor: "#00E5E5", dominio: "neon.com.br", texto: "#0B2E2E" },
  { nome: "Next", apelidos: ["next", "banco next"], cor: "#00FF5F", dominio: "next.me", texto: "#111111" },
  { nome: "Original", apelidos: ["original", "banco original"], cor: "#00A859", dominio: "original.com.br" },
  { nome: "Safra", apelidos: ["safra", "banco safra"], cor: "#003B71", dominio: "safra.com.br" },
  { nome: "Sicoob", apelidos: ["sicoob", "banco sicoob"], cor: "#00A091", dominio: "sicoob.com.br" },
  { nome: "Sicredi", apelidos: ["sicredi"], cor: "#3FA110", dominio: "sicredi.com.br" },
  { nome: "Banrisul", apelidos: ["banrisul", "banco do estado do rio grande do sul"], cor: "#0066B3", dominio: "banrisul.com.br" },
  { nome: "BRB", apelidos: ["brb", "banco de brasilia"], cor: "#00539B", dominio: "brb.com.br" },
  { nome: "Banco Pan", apelidos: ["pan", "banco pan", "bancopan"], cor: "#00AEEF", dominio: "bancopan.com.br" },
  { nome: "Will Bank", apelidos: ["will", "will bank", "willbank"], cor: "#FFD400", dominio: "willbank.com.br", texto: "#111111" },
  { nome: "Porto", apelidos: ["porto", "porto bank", "porto seguro", "portoseguro"], cor: "#0066CC", dominio: "portoseguro.com.br" },
  { nome: "Pefisa", apelidos: ["pefisa"], cor: "#E30613", dominio: "pefisa.com.br" },
  { nome: "Renner", apelidos: ["renner", "lojas renner", "meu cartao renner", "realize"], cor: "#E4002B", dominio: "lojasrenner.com.br" },
  { nome: "Carrefour", apelidos: ["carrefour", "banco carrefour", "cartao carrefour"], cor: "#004E9F", dominio: "carrefour.com.br" },
  { nome: "Pernambucanas", apelidos: ["pernambucanas", "banco pernambucanas", "arteirasbank"], cor: "#E2001A", dominio: "pernambucanas.com.br" },
  { nome: "C&A", apelidos: ["c&a", "cea", "banco cea", "c a"], cor: "#0F3E8C", dominio: "cea.com.br" },
  { nome: "Riachuelo", apelidos: ["riachuelo", "midway", "guararapes"], cor: "#E4002B", dominio: "riachuelo.com.br" },
  { nome: "Magalu", apelidos: ["magalu", "magazine luiza", "luizacred", "magalupay"], cor: "#0086FF", dominio: "magazineluiza.com.br" },
  { nome: "Casas Bahia", apelidos: ["casas bahia", "banco casas bahia"], cor: "#0033A0", dominio: "casasbahia.com.br" },
  { nome: "Americanas", apelidos: ["americanas", "ame digital", "ame"], cor: "#E60014", dominio: "americanas.com.br" },
  { nome: "Banco Votorantim", apelidos: ["votorantim", "banco votorantim", "bv", "banco bv"], cor: "#0066B3", dominio: "bv.com.br" },
  { nome: "Daycoval", apelidos: ["daycoval", "banco daycoval"], cor: "#003DA5", dominio: "daycoval.com.br" },
  { nome: "Banco Master", apelidos: ["master", "banco master"], cor: "#1B1B1B", dominio: "bancomaster.com.br" },
  { nome: "Agibank", apelidos: ["agibank", "agi"], cor: "#00A859", dominio: "agibank.com.br" },
  { nome: "Banco Bmg", apelidos: ["bmg", "banco bmg"], cor: "#F26B21", dominio: "bancobmg.com.br" },
  { nome: "Banestes", apelidos: ["banestes"], cor: "#005AA7", dominio: "banestes.com.br" },
  { nome: "Banese", apelidos: ["banese"], cor: "#00A859", dominio: "banese.com.br" },
  { nome: "Banco do Nordeste", apelidos: ["banco do nordeste", "bnb"], cor: "#E30613", dominio: "bnb.gov.br" },
  { nome: "Banco da Amazônia", apelidos: ["banco da amazonia", "basa"], cor: "#00693E", dominio: "bancoamazonia.com.br" },
  { nome: "Cora", apelidos: ["cora"], cor: "#FE3E6D", dominio: "cora.com.br" },
  { nome: "Stone", apelidos: ["stone", "stone pagamentos"], cor: "#00A868", dominio: "stone.com.br" },
  { nome: "Mercantil", apelidos: ["mercantil", "banco mercantil"], cor: "#E30613", dominio: "mercantil.com.br" },
  { nome: "Rico", apelidos: ["rico", "rico investimentos"], cor: "#FF6B00", dominio: "rico.com.vc" },
  { nome: "Warren", apelidos: ["warren"], cor: "#FF3E6C", dominio: "warrenbrasil.com.br" },
  { nome: "Nomad", apelidos: ["nomad"], cor: "#FFD400", dominio: "nomadglobal.com", texto: "#111111" },
  { nome: "Wise", apelidos: ["wise", "transferwise"], cor: "#9FE870", dominio: "wise.com", texto: "#163300" },
  { nome: "Dinheiro", apelidos: ["dinheiro", "especie", "carteira"], cor: "#16A34A", dominio: "" },
];

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();

const ESCAPE = /[.*+?^${}()|[\]\\]/g;
const INDICE = BANCOS_CATALOGO.flatMap((b) =>
  [...b.apelidos, semAcento(b.nome)].map((a) => ({
    banco: b,
    a,
    re: new RegExp(`(^| )${a.replace(ESCAPE, "\\$&")}( |$)`),
  })),
).sort((x, y) => y.a.length - x.a.length);

/** Acha o banco do catálogo pelo texto livre ("BANCO ITAU", "itau 1234"). Prefere o apelido mais longo. */
export function acharBanco(texto: string | null | undefined): BancoCatalogo | null {
  const t = semAcento(String(texto ?? ""));
  if (!t) return null;
  return INDICE.find((i) => i.re.test(t))?.banco ?? null;
}

/**
 * Normaliza o nome: usa o nome do catálogo quando casar (preserva o que vier depois, como "•1234");
 * senão deixa a primeira letra de cada palavra maiúscula.
 */
export function nomeBanco(texto: string | null | undefined): string {
  const bruto = String(texto ?? "").trim().replace(/\s+/g, " ");
  if (!bruto) return "";
  const b = acharBanco(bruto);
  if (b) {
    const resto = bruto.match(/[•·].*$/)?.[0];
    return resto ? `${b.nome} ${resto}` : b.nome;
  }
  const minusc = new Set(["de", "da", "do", "das", "dos", "e"]);
  return bruto
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && minusc.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export function iniciaisBanco(texto: string | null | undefined): string {
  const nome = nomeBanco(texto).replace(/[^A-Za-zÀ-ÿ0-9 &]/g, "").trim();
  const p = nome.split(" ").filter(Boolean);
  if (p.length === 0) return "$";
  return (p.length > 1 ? (p[0]?.[0] ?? "") + (p[1]?.[0] ?? "") : nome.slice(0, 2)).toUpperCase();
}

export function visualBanco(texto: string | null | undefined) {
  const b = acharBanco(texto);
  return {
    nome: nomeBanco(texto),
    cor: b?.cor ?? "#64748B",
    texto: b?.texto ?? "#FFFFFF",
    iniciais: iniciaisBanco(texto),
    icone: b?.dominio ? `https://www.google.com/s2/favicons?domain=${b.dominio}&sz=128` : null,
  };
}

/** Id do banco no catálogo (14/11/2026): slug do nome ("Banco do Brasil" vira "banco-do-brasil"). Chave da tabela logos_bancos. */
export function idBanco(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
