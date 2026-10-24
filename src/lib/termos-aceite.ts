import { VERSAO_TEXTOS_LEGAIS } from "@/lib/textos-legais";

// LGPD (arts. 8º e 9º): guarda qual versão dos Termos e da Política a pessoa aceitou e quando.
// Fica nos metadados do usuário no Supabase Auth, sem mudar o banco.
export function metadadosAceite() {
  return {
    termos_versao: VERSAO_TEXTOS_LEGAIS,
    termos_aceitos_em: new Date().toISOString(),
    declarou_maioridade: true,
  };
}

export const MSG_MENOR_DE_IDADE = "O Control ALL é destinado a maiores de 18 anos.";

/** Termos, item 4.2: só maiores de 18 anos criam conta. */
export function menorDeIdade(nascimento: Date, hoje = new Date()): boolean {
  if (Number.isNaN(nascimento.getTime())) return false;
  const limite = new Date(hoje.getFullYear() - 18, hoje.getMonth(), hoje.getDate());
  return nascimento > limite;
}
