export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let check = ((sum * 10) % 11) % 10;
  if (check !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  check = ((sum * 10) % 11) % 10;
  return check === Number(cpf[10]);
}

export const CPF_EMAIL_DOMAIN = "financascasal.app";

export function cpfToEmail(cpf: string): string {
  return `${onlyDigits(cpf)}@${CPF_EMAIL_DOMAIN}`;
}

/** Mostra apenas os 3 últimos dígitos: ***.***.**6-35 style */
export function maskCpfPrivate(cpf: string): string {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return "***";
  return `***.***.*${d.slice(8, 9)}-${d.slice(9)}`;
}
