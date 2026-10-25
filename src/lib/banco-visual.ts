/**
 * Cor e iniciais de cada banco, para o ícone quando o logo oficial (da Pluggy) não carrega.
 * Não desenha logo: é só um círculo com as iniciais na cor principal do banco. (25/10/2026)
 */
const BANCOS: { teste: RegExp; sigla: string; cor: string; texto?: string }[] = [
  { teste: /nubank|nu pagamentos/i, sigla: "Nu", cor: "#820AD1" },
  { teste: /ita[uú]/i, sigla: "It", cor: "#EC7000" },
  { teste: /santander/i, sigla: "Sa", cor: "#EC0000" },
  { teste: /bradesco/i, sigla: "Br", cor: "#CC092F" },
  { teste: /\binter\b/i, sigla: "In", cor: "#FF7A00" },
  { teste: /\bc6\b/i, sigla: "C6", cor: "#242424" },
  { teste: /banco do brasil|\bbb\b/i, sigla: "BB", cor: "#FAE128", texto: "#0038A8" },
  { teste: /caixa/i, sigla: "Cx", cor: "#005CA9" },
  { teste: /picpay/i, sigla: "Pp", cor: "#21C25E" },
  { teste: /mercado ?pago/i, sigla: "MP", cor: "#00B1EA" },
  { teste: /btg/i, sigla: "BT", cor: "#0D2C54" },
  { teste: /\bxp\b/i, sigla: "XP", cor: "#111111" },
  { teste: /sicoob/i, sigla: "Sc", cor: "#00A091" },
  { teste: /sicredi/i, sigla: "Si", cor: "#3FA110" },
];

export function visualDoBanco(nome: string | null | undefined): { sigla: string; cor: string; texto: string } {
  const n = String(nome ?? "");
  const b = BANCOS.find((x) => x.teste.test(n));
  if (b) return { sigla: b.sigla, cor: b.cor, texto: b.texto ?? "#FFFFFF" };
  const sigla = n.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").trim().slice(0, 2) || "$";
  return { sigla, cor: "#64748B", texto: "#FFFFFF" };
}
