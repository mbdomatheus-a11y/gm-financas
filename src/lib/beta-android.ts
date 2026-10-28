import { supabase } from "@/integrations/supabase/client";

/**
 * Beta do Android (28/10/2026), no mesmo formato do TestFlight do iPhone.
 * Entrada: o grupo do Google (qualquer pessoa entra) + o link de participação do teste na Play Store.
 * O Google Groups não limita membros; o limite de 50 vagas é controlado aqui (reserva por conta do site).
 * Enquanto o Google não aprovar a versão de teste, o card mostra "em breve". Quem abre é o admin, em
 * Administração > Avisos dispensáveis (coluna configuracoes_acesso_site.beta_android_aberto).
 */
export const LIMITE_BETA_ANDROID = 50;
export const LINK_GRUPO_ANDROID = "https://groups.google.com/g/controlall-testadores?hl=pt-BR";
export const LINK_TESTE_ANDROID = "https://play.google.com/apps/testing/com.matheus.controlall?hl=pt-BR";

export async function vagasUsadasAndroid(): Promise<number | null> {
  const { data, error } = await (supabase as any).rpc("vagas_beta_android");
  if (error) return null;
  return Number(data) || 0;
}

export type ResultadoReserva = "reservada" | "ja_reservada" | "lotado" | "sem_login" | "erro";
export async function reservarVagaAndroid(): Promise<ResultadoReserva> {
  const { data, error } = await (supabase as any).rpc("reservar_vaga_beta_android");
  if (error) return "erro";
  return (data as ResultadoReserva) ?? "erro";
}
