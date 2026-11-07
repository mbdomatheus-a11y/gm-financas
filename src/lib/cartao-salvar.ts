import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

/**
 * Cadastro de cartão compartilhado (07/11/2026): a tela Cartões e a Configuração inicial
 * (Boas-vindas) gravam pelo mesmo caminho. `limite` null = cartão sem limite.
 */
export const cartaoSchema = z.object({
  apelido: z.string().trim().min(2, "Informe um apelido").max(60),
  bandeira: z.string().min(1, "Selecione a bandeira"),
  final: z.string().regex(/^\d{4}$/, "Informe os 4 últimos dígitos"),
  limite: z.number().nonnegative().nullable(),
  dia_fechamento: z.number().int().min(1).max(31),
  dia_vencimento: z.number().int().min(1).max(31),
  banco_id: z.string().uuid().nullable(),
  cor: z.string(),
  titular: z.string().min(1, "Informe o titular"),
  tipo: z.string().min(1),
});

export type CartaoDados = z.infer<typeof cartaoSchema>;

/** Insere (sem id) ou atualiza (com id) um cartão. O fechamento informado à mão vale como confirmado. */
export async function salvarCartao(dados: CartaoDados, id?: string | null): Promise<void> {
  const linha = { ...dados, fechamento_confirmado: true };
  const { error } = id
    ? await supabase.from("cartoes").update(linha as any).eq("id", id)
    : await supabase.from("cartoes").insert(linha as any);
  if (error) throw error;
}

/** Melhor dia de compra: o dia seguinte ao fechamento (a compra cai só na fatura seguinte). */
export function melhorDiaCompra(diaFechamento: number | string | null | undefined): number | null {
  const n = Number(diaFechamento);
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  return n >= 31 ? 1 : n + 1;
}
