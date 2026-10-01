import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RascunhoIASchema, RASCUNHO_VAZIO, type ContextoLancamentoIA } from "@/lib/lancamento-ia";

/**
 * Lançamento rápido por texto/áudio (IA) — server functions. Server-only:
 * nunca importar isto de um componente client. Ver
 * `claude/plano-lancamento-ia-2026-10-01.md` no projeto Claude.
 *
 * Mesmo padrão de `nfe.functions.ts`/`drive.functions.ts`: `fetch` puro
 * (sem SDK novo), chave em env var server-only (`process.env["..."]`, nunca
 * no bundle do client — mesmo esquema de `SUPABASE_SERVICE_ROLE_KEY`).
 */

function chaveOpenAI(): string | null {
  const chave = process.env["OPENAI_API_KEY"];
  return chave && chave.trim() ? chave.trim() : null;
}

function montarPrompt(ctx: ContextoLancamentoIA): string {
  return [
    "Você extrai dados de um lançamento financeiro (despesa ou receita) a partir de um texto escrito por um usuário comum, em português do Brasil.",
    "Responda APENAS com um objeto JSON válido, sem markdown, sem comentários, exatamente com estas chaves:",
    `{"tipo": "despesa" | "receita" | null, "descricao": string | null, "valor": number | null, "data": "AAAA-MM-DD" | null, "categoria": string | null, "responsavel": string | null, "forma_pagamento": string | null, "parcelas": number | null, "confianca": number entre 0 e 1, "campos_faltantes": string[], "observacao_ia": string | null}`,
    "",
    "REGRA DE OURO: nunca invente. Se um campo não puder ser determinado com segurança a partir do texto, devolva null para ele e liste o nome em campos_faltantes. Nunca chute valor, data ou categoria.",
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
function extrairJson(texto: string): unknown {
  const limpo = texto
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(limpo);
}

export const interpretarLancamentoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { texto: string; contexto: ContextoLancamentoIA }) => input)
  .handler(async ({ data }) => {
    const apiKey = chaveOpenAI();
    if (!apiKey) {
      return {
        ...RASCUNHO_VAZIO,
        observacao_ia:
          "IA não configurada (faltando OPENAI_API_KEY no servidor). Preencha manualmente.",
      };
    }
    const texto = data.texto.trim();
    if (!texto) return RASCUNHO_VAZIO;

    const modelo = process.env["OPENAI_MODEL_TEXTO"] || "gpt-4o-mini";

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelo,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: montarPrompt(data.contexto) },
            { role: "user", content: texto },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const corpo = await res.text().catch(() => "");
        return {
          ...RASCUNHO_VAZIO,
          observacao_ia:
            `IA indisponível (${res.status}). Preencha manualmente. ${corpo.slice(0, 200)}`.trim(),
        };
      }

      const payload = await res.json();
      const conteudo: string | undefined = payload?.choices?.[0]?.message?.content;
      if (!conteudo) {
        return { ...RASCUNHO_VAZIO, observacao_ia: "IA respondeu vazio. Preencha manualmente." };
      }

      const bruto = extrairJson(conteudo);
      const parsed = RascunhoIASchema.safeParse(bruto);
      if (!parsed.success) {
        return {
          ...RASCUNHO_VAZIO,
          observacao_ia: "Não entendi a resposta da IA. Preencha manualmente.",
        };
      }
      return parsed.data;
    } catch {
      return {
        ...RASCUNHO_VAZIO,
        observacao_ia: "Falha ao contatar a IA (rede ou tempo esgotado). Preencha manualmente.",
      };
    }
  });

export const transcreverAudioIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audioBase64: string; mimeType: string }) => input)
  .handler(async ({ data }): Promise<{ texto: string; erro?: string }> => {
    const apiKey = chaveOpenAI();
    if (!apiKey) {
      return { texto: "", erro: "IA não configurada (faltando OPENAI_API_KEY no servidor)." };
    }
    const modelo = process.env["OPENAI_MODEL_AUDIO"] || "whisper-1";

    let buffer: Buffer;
    try {
      buffer = Buffer.from(data.audioBase64, "base64");
    } catch {
      return { texto: "", erro: "Áudio inválido." };
    }
    if (buffer.length === 0) return { texto: "", erro: "Áudio vazio." };
    if (buffer.length > 24 * 1024 * 1024) {
      return { texto: "", erro: "Áudio muito grande (máximo 24MB)." };
    }

    try {
      const form = new FormData();
      const extensao = data.mimeType.includes("mp4") ? "m4a" : "webm";
      form.append(
        "file",
        new Blob([new Uint8Array(buffer)], { type: data.mimeType }),
        `audio.${extensao}`,
      );
      form.append("model", modelo);
      form.append("language", "pt");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const corpo = await res.text().catch(() => "");
        return {
          texto: "",
          erro: `Transcrição indisponível (${res.status}). ${corpo.slice(0, 200)}`.trim(),
        };
      }
      const payload = await res.json();
      const texto = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!texto) return { texto: "", erro: "Não entendi o áudio — tente de novo ou digite." };
      return { texto };
    } catch {
      return { texto: "", erro: "Falha ao transcrever (rede ou tempo esgotado)." };
    }
  });
