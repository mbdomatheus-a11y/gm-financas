/** Utilidades para chave de acesso da NF-e / NFC-e (44 dígitos). Client-safe. */

export const UFS: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
  "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
  "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

export function somenteDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Extrai a chave de 44 dígitos de um texto, URL de QR Code ou código de barras. */
export function extrairChave(texto: string): string | null {
  if (!texto) return null;
  const porParam = /(?:chNFe|p)=([0-9]{44})/i.exec(texto);
  if (porParam?.[1]) return porParam[1];
  const digitos = somenteDigitos(texto);
  const match = /[0-9]{44}/.exec(digitos);
  return match ? match[0] : null;
}

/** Valida o dígito verificador (módulo 11) da chave. */
export function chaveValida(chave: string): boolean {
  const c = somenteDigitos(chave);
  if (c.length !== 44) return false;
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let i = 0;
  for (let pos = 42; pos >= 0; pos--) {
    soma += Number(c[pos]) * (pesos[i % 8] ?? 2);
    i++;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return dv === Number(c[43]);
}

export type DadosChave = {
  uf: string | null;
  emissao: string | null;
  cnpj: string | null;
  modelo: string;
  numero: string;
};

/** Lê UF, data de emissão (AAAA-MM-01), CNPJ e número a partir da própria chave. */
export function dadosDaChave(chave: string): DadosChave | null {
  const c = somenteDigitos(chave);
  if (c.length !== 44) return null;
  const uf = UFS[c.slice(0, 2)] ?? null;
  const ano = 2000 + Number(c.slice(2, 4));
  const mes = c.slice(4, 6);
  const emissao = Number(mes) >= 1 && Number(mes) <= 12 ? `${ano}-${mes}-01` : null;
  return {
    uf,
    emissao,
    cnpj: c.slice(6, 20),
    modelo: c.slice(20, 22),
    numero: String(Number(c.slice(25, 34))),
  };
}

export function formatarChave(chave: string): string {
  return (somenteDigitos(chave).match(/.{1,4}/g) ?? []).join(" ");
}

export function formatarCNPJ(cnpj: string): string {
  const c = somenteDigitos(cnpj);
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** Link público de consulta da nota pela chave. */
export function linkConsulta(chave: string): string {
  return `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&nfe=${somenteDigitos(chave)}`;
}

export const PRAZOS_GARANTIA = [
  { label: "Sem garantia", meses: 0 },
  { label: "90 dias", meses: 3 },
  { label: "6 meses", meses: 6 },
  { label: "12 meses", meses: 12 },
  { label: "24 meses", meses: 24 },
  { label: "36 meses", meses: 36 },
];

export function calcularFimGarantia(dataCompra: string, meses: number): string | null {
  if (!dataCompra || !meses) return null;
  const d = new Date(`${dataCompra.slice(0, 10)}T12:00:00`);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function diasRestantes(fim: string | null | undefined): number | null {
  if (!fim) return null;
  const alvo = new Date(`${fim.slice(0, 10)}T12:00:00`).getTime();
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.round((alvo - hoje.getTime()) / 86400000);
}

export type StatusGarantia = "sem" | "expirada" | "critica" | "atencao" | "ativa";

export function statusGarantia(fim: string | null | undefined): StatusGarantia {
  const dias = diasRestantes(fim);
  if (dias === null) return "sem";
  if (dias < 0) return "expirada";
  if (dias <= 15) return "critica";
  if (dias <= 30) return "atencao";
  return "ativa";
}
