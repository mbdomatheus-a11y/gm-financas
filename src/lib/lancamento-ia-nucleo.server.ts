import { aplicarLimite } from "@/lib/rate-limit.server";
import type { ContextoLancamentoIA } from "@/lib/lancamento-ia";

/** Núcleo da IA de lançamento (15/11/2026): só servidor. Usado pelas server functions
 * de lancamento-ia.functions.ts e pela rota /api/atalho. Fica em .server para não
 * entrar no bundle do navegador. */

export function chaveOpenAI(): string | null {
  const chave = process.env["OPENAI_API_KEY"];
  return chave && chave.trim() ? chave.trim() : null;
}

/** Limite diário de uso saudável (Frente 1 do plano de 2026-10-02): conta por
 * USO (texto, áudio ou resumo — qualquer chamada que bate na OpenAI), não por
 * token cru — mais simples de explicar pro usuário e o custo por uso já é
 * uniforme o bastante. Reaproveita a tabela genérica `rate_limit_eventos`
 * (mesma usada pelo rate-limit de login/recuperação de senha), chaveada pelo
 * `userId` em vez de IP/e-mail. Lança (via `aplicarLimite`) quando estourado;
 * quem chama decide a mensagem amigável de volta pro usuário.
 */
const COTA_IA_POR_DIA = 30;
export async function verificarCotaIA(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // 27/10/2026: rajada de 10 pedidos por minuto e cota diária; passou, responde 429 + Retry-After.
  await aplicarLimite(supabaseAdmin as any, {
    rota: "ia_rajada_minuto",
    chave: userId,
    maxPorJanela: 10,
    janelaMinutos: 1,
    mensagem: "Muitos pedidos à IA em sequência. Espere um minuto e tente de novo.",
  });
  await aplicarLimite(supabaseAdmin as any, {
    rota: "ia_lancamento_uso",
    chave: userId,
    maxPorJanela: COTA_IA_POR_DIA,
    janelaMinutos: 24 * 60,
    mensagem: `Limite diário de uso da IA atingido (${COTA_IA_POR_DIA} usos/dia, entre texto, áudio e resumo). Volta amanhã ou preencha manualmente.`,
  });
  return null;
}

export function montarPrompt(ctx: ContextoLancamentoIA): string {
  return [
    "Você extrai dados de um lançamento financeiro (despesa ou receita) a partir de um texto escrito por um usuário comum, em português do Brasil.",
    "Responda APENAS com um objeto JSON válido, sem markdown, sem comentários, exatamente com estas chaves:",
    `{"tipo": "despesa" | "receita" | null, "descricao": string | null, "observacao": string | null, "valor": number | null, "data": "AAAA-MM-DD" | null, "categoria": string | null, "responsavel": string | null, "forma_pagamento": string | null, "parcelas": number | null, "confianca": number entre 0 e 1, "campos_faltantes": string[], "observacao_ia": string | null}`,
    "",
    "REGRA DE OURO: nunca invente. Se um campo não puder ser determinado com segurança a partir do texto, devolva null para ele e liste o nome em campos_faltantes. Nunca chute valor, data ou categoria.",
    'descricao deve ser CURTA e objetiva — poucas palavras, o essencial (ex.: "Almoço com amigos", "Mercado do mês", "Salário"). NUNCA transcreva o texto inteiro do usuário em descricao. Qualquer detalhe adicional que o usuário tenha mencionado (motivo, contexto, combinação feita, quem estava junto etc.) vai em observacao, nunca concatenado em descricao. Se não houver nada além do essencial, observacao fica null. Escreva descricao e observacao em português normal: só a primeira letra maiúscula, o resto minúsculo, mantendo siglas (PIX, IPVA) e nomes próprios.',
    `Data de hoje (para resolver "hoje", "ontem", "dia 5" etc.): ${ctx.hoje}.`,
    `Usuário logado (para resolver "eu paguei", "eu recebi"): ${ctx.usuarioAtual ?? "desconhecido"}.`,
    ctx.perfis.length
      ? `Pessoas válidas para "responsavel" (use o nome exatamente como aparece aqui, ou null se não for possível identificar): ${ctx.perfis.join(", ")}.`
      : "",
    ctx.categoriasDespesa.length
      ? `Categorias válidas de DESPESA (use exatamente um destes nomes, ou null): ${ctx.categoriasDespesa.join(", ")}.`
      : "",
    ctx.categoriasReceita.length
      ? `Categorias válidas de RECEITA (use exatamente um destes nomes, ou null): ${ctx.categoriasReceita.join(", ")}.`
      : "",
    ctx.formasPagamento.length
      ? `Formas de pagamento cadastradas (cartões/bancos — use exatamente um destes nomes quando o texto mencionar algo parecido; para pix/dinheiro/débito sem cartão específico, descreva livremente, ex. "Pix" ou "Dinheiro"; ou null se não mencionado): ${ctx.formasPagamento.join(", ")}.`
      : "",
    'Se o texto descrever algo que parece uma despesa FIXA/recorrente (ex. aluguel, assinatura mensal), ainda assim preencha os campos normalmente, mas em observacao_ia avise: "Parece uma despesa fixa — cadastre em /despesas para usar o motor de recorrência completo."',
    'O campo parcelas é o número de parcelas (ex. "em 3x" => 3); se não houver menção a parcelamento, use 1, nunca null (a menos que o resto também seja incerto).',
    "valor é sempre o valor de UMA parcela se parcelado foi informado como valor da parcela, ou o valor total se foi informado o total — leia o texto com atenção para não confundir; quando ambíguo, prefira null e explique em observacao_ia.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Extrai o primeiro bloco JSON de uma string (alguns modelos ainda cercam
 * a resposta com ```json apesar da instrução) — nunca confia no formato. */
export function extrairJson(texto: string): unknown {
  const limpo = texto
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(limpo);
}

