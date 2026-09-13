export type MetadadosFatura = {
  periodo: { inicio: string | null; fim: string | null };
  titulares: string[];
  subtotais: Array<{ rotulo: string; valor: number }>;
};

const TERMOS_RESUMO = [
  "total da fatura",
  "total a pagar",
  "valor total",
  "limite",
  "proximas faturas",
  "saldo futuro",
  "valor do documento",
  "codigo de barras",
  "linha digitavel",
  "boleto",
  "oferta",
];

function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function ehLinhaResumoFatura(texto: string): boolean {
  const normalizado = semAcento(texto);
  return TERMOS_RESUMO.some((termo) => normalizado.includes(termo));
}

function parseValorLocal(raw: string): number {
  const numero = Number(
    raw.replace(/\s/g, "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", "."),
  );
  return Number.isFinite(numero) ? numero : 0;
}

function dataIsoEncontrada(raw: string): string | null {
  const m = raw.match(/(\d{2})[/.\-](\d{2})[/.\-](\d{2,4})/);
  if (!m) return null;
  const [, dia, mes, anoBruto] = m;
  if (!dia || !mes || !anoBruto) return null;
  const ano = anoBruto.length === 2 ? `20${anoBruto}` : anoBruto;
  return `${ano}-${mes}-${dia}`;
}

function capitalizar(raw: string): string {
  const minusculas = new Set(["da", "de", "do", "das", "dos", "e", "em"]);
  return raw
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((palavra, indice) =>
      indice > 0 && minusculas.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1),
    )
    .join(" ");
}

function capitalizarRotulo(raw: string): string {
  const texto = raw.trim().toLocaleLowerCase("pt-BR");
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

/** Identifica dados de capa e resumos sem transformá-los em despesas. */
export function extrairMetadadosFatura(texto: string): MetadadosFatura {
  const periodoMatch = texto.match(
    /(?:per[ií]odo|compras?\s+de)\D{0,20}(\d{2}[/.\-]\d{2}[/.\-]\d{2,4})\D{1,20}(?:a|at[eé])\D{0,10}(\d{2}[/.\-]\d{2}[/.\-]\d{2,4})/i,
  );
  const titulares = new Set<string>();
  for (const linha of texto.split("\n")) {
    const m = linha.match(
      /(?:titular|cart[aã]o\s+de)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{2,60})/i,
    );
    const nome = m?.[1];
    if (nome) titulares.add(capitalizar(nome));
  }
  const subtotais: MetadadosFatura["subtotais"] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.match(
      /^\s*((?:sub)?total(?:\s+(?:do|da|cart[aã]o|compras?|despesas?)[^\d]{0,40})?)\s+(R?\$?\s*[\d.]+,\d{2})\s*$/i,
    );
    const rotulo = m?.[1]?.replace(/\s*R\$\s*$/i, "").trim();
    const valorBruto = m?.[2];
    if (!rotulo || !valorBruto || /total\s+(?:da\s+)?fatura|total\s+a\s+pagar/i.test(rotulo))
      continue;
    const valor = parseValorLocal(valorBruto);
    if (valor) subtotais.push({ rotulo: capitalizarRotulo(rotulo), valor: Math.abs(valor) });
  }
  return {
    periodo: periodoMatch
      ? {
          inicio: dataIsoEncontrada(periodoMatch[1] ?? ""),
          fim: dataIsoEncontrada(periodoMatch[2] ?? ""),
        }
      : { inicio: null, fim: null },
    titulares: Array.from(titulares),
    subtotais,
  };
}
