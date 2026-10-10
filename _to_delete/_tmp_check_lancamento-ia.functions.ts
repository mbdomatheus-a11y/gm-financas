import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aplicarLimite } from "@/lib/rate-limit.server";
import {
  RascunhoIASchema,
  RASCUNHO_VAZIO,
  LIMITE_CARACTERES_TEXTO_IA,
  type ContextoLancamentoIA,
  type ResumoFinanceiroContexto,
} from "@/lib/lancamento-ia";
import { grupoDoUsuario, resolverModoIaLancamento } from "@/lib/ia-lancamento-modo.functions";

/**
 * Lançamento rápido por texto/áudio (IA) — server functions. Server-only:
 * nunca importar isto de um componente client. Ver
 * `claude/plano-lancamento-ia-2026-10-01.md` e
 * `claude/plano-fase2-lancamento-2026-10-02.md` no projeto Claude.
 *
 * Mesmo padrão de `nfe.functions.ts`/`drive.functions.ts`: `fetch` puro
 * (sem SDK novo), chave em env var server-only (`process.env["..."]`, nunca
 * no bundle do client — mesmo esquema de `SUPABASE_SERVICE_ROLE_KEY`).
 */

function chaveOpenAI(): string | null {
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
async function verificarCotaIA(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await aplicarLimite(supabaseAdmin as any, {
      rota: "ia_lancamento_uso",
      chave: userId,
      maxPorJanela: COTA_IA_POR_DIA,
      janelaMinutos: 24 * 60,
    });
    return null;
  } catch {
    return `Limite diário de uso da IA atingido (${COTA_IA_POR_DIA} usos/dia, entre texto, áudio e resumo). Volta amanhã ou preencha manualmente.`;
  }
}

/** Frente 2 do plano de 2026-10-02: trava de servidor pro controle de modo
 * (texto/áudio/ambos/desabilitado) que o admin do site e o admin do grupo
 * definem em `ia-lancamento-modo.functions.ts`. Não basta esconder o botão
 * na UI — um usuário determinado poderia chamar a server function direto,
 * então a verificação real tem que ficar aqui também.
 *
 * `resumoFinanceiroIA` só aceita pergunta em TEXTO (não tem opção de áudio
 * na UI), então ela é tratada como "entrada de texto" pra esse controle:
 * com modo "somente_audio" ela também fica bloqueada, e com "somente_texto"
 * continua liberada. "desabilitado" bloqueia todo o módulo de IA, incluindo
 * o resumo.
 *
 * `interpretarLancamentoIA` é infraestrutura compartilhada: tanto texto
 * digitado quanto a transcrição de um áudio passam pelo mesmo campo `texto`.
 * Por isso ela chama isto com `tipoEntrada` baseado no `data.origem` que o
 * client manda (ver o comentário no inputValidator dela) em vez de sempre
 * "texto" — senão o modo "somente_audio" bloquearia até quem gravou áudio
 * de verdade, o que tornaria esse modo inutilizável. */
async function verificarModoIA(
  context: { supabase: any; userId: string },
  tipoEntrada: "texto" | "audio",
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const grupoId = await grupoDoUsuario(context);
  const modo = await resolverModoIaLancamento(supabaseAdmin as any, grupoId);
  if (modo === "desabilitado") {
    return "O uso da IA para lançamentos/resumo está desativado pelo administrador. Preencha manualmente.";
  }
  if (tipoEntrada === "texto" && modo === "somente_audio") {
    return "O administrador liberou apenas entrada por áudio para a IA neste momento. Grave um áudio ou preencha manualmente.";
  }
  if (tipoEntrada === "audio" && modo === "somente_texto") {
    return "O administrador liberou apenas entrada por texto para a IA neste momento. Digite ou preencha manualmente.";
  }
  return null;
}

function montarPrompt(ctx: ContextoLancamentoIA): string {
  return [
    "Você extrai dados de um lançamento financeiro (despesa ou receita) a partir de um texto escrito por um usuário comum, em português do Brasil.",
    "Responda APENAS com um objeto JSON válido, sem markdown, sem comentários, exatamente com estas chaves:",
    `{"tipo": "despesa" | "receita" | null, "descricao": string | null, "observacao": string | null, "valor": number | null, "data": "AAAA-MM-DD" | null, "categoria": string | null, "responsavel": string | null, "forma_pagamento": string | null, "parcelas": number | null, "confianca": number entre 0 e 1, "campos_faltantes": string[], "observacao_ia": string | null}`,
    "",
    "REGRA DE OURO: nunca invente. Se um campo não puder ser determinado com segurança a partir do texto, devolva null para ele e liste o nome em campos_faltantes. Nunca chute valor, data ou categoria.",
    'descricao deve ser CURTA e objetiva — poucas palavras, o essencial (ex.: "Almoço com amigos", "Mercado do mês", "Salário"). NUNCA transcreva o texto inteiro do usuário em descricao. Qualquer detalhe adicional que o usuário tenha mencionado (motivo, contexto, combinação feita, quem estava junto etc.) vai em observacao, nunca concatenado em descricao. Se não houver nada além do essencial, observacao fica null.',
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
  .inputValidator(
    (input: {
      texto: string;
      contexto: ContextoLancamentoIA;
      /** "audio" quando o texto chegou aqui a partir de uma transcrição
       * (`transcreverAudioIA`) nesta mesma sessão de diálogo, "manual" (ou
       * ausente) quando foi digitado. Usado só pra resolver o modo
       * "somente_audio" sem bloquear quem legitimamente gravou um áudio —
       * ver comentário de `verificarModoIA`. Não é uma prova criptográfica de
       * origem (o client podia mentir), então isto é tratado como
       * preferência do admin, não trava de segurança — mesmo espírito do
       * "fail open" de `resolverModoIaLancamento`. */
      origem?: "manual" | "audio";
    }) => input,
  )
  .handler(async ({ data, context }) => {
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
    if (texto.length > LIMITE_CARACTERES_TEXTO_IA) {
      return {
        ...RASCUNHO_VAZIO,
        observacao_ia: `Texto muito longo (máx. ${LIMITE_CARACTERES_TEXTO_IA} caracteres) — resuma em poucas palavras ou preencha manualmente.`,
      };
    }
    const avisoModo = await verificarModoIA(context, data.origem === "audio" ? "audio" : "texto");
    if (avisoModo) return { ...RASCUNHO_VAZIO, observacao_ia: avisoModo };
    const avisoCota = await verificarCotaIA(context.userId);
    if (avisoCota) return { ...RASCUNHO_VAZIO, observacao_ia: avisoCota };

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
  .handler(async ({ data, context }): Promise<{ texto: string; erro?: string }> => {
    const apiKey = chaveOpenAI();
    if (!apiKey) {
      return { texto: "", erro: "IA não configurada (faltando OPENAI_API_KEY no servidor)." };
    }
    const avisoModo = await verificarModoIA(context, "audio");
    if (avisoModo) return { texto: "", erro: avisoModo };
    const avisoCota = await verificarCotaIA(context.userId);
    if (avisoCota) return { texto: "", erro: avisoCota };

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

/** Monta o prompt do resumo financeiro — só TRADUZ os números em texto, nunca
 * recalcula nem inventa valor novo (mesma regra de ouro do lançamento). O
 * resumo (`ResumoFinanceiroContexto`) é calculado no client a partir dos
 * mesmos dados que o Dashboard já usa — ver `useResumoFinanceiroMes`. */
function montarPromptResumo(r: ResumoFinanceiroContexto, pergunta: string): string {
  const [ano, mes] = r.competencia.split("-");
  const nomesMes = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const mesExtenso = `${nomesMes[Number(mes) - 1] ?? mes} de ${ano}`;
  const categorias = r.topCategoriasDespesa
    .map((c) => `${c.categoria}: R$ ${c.total.toFixed(2)}`)
    .join("; ");

  return [
    "Você é um assistente financeiro que resume, em português do Brasil, a situação do mês de um usuário comum, em 3 a 5 frases curtas, tom direto e acolhedor, sem jargão técnico.",
    "REGRA DE OURO: use SOMENTE os números abaixo — nunca invente, estime ou arredonde de forma que mude o sentido. Se um dado não estiver aqui, diga que não tem essa informação em vez de supor.",
    `Mês de referência: ${mesExtenso}.`,
    `Total de receitas no mês: R$ ${r.totalReceitas.toFixed(2)} (${r.numLancamentosReceita} lançamento(s)).`,
    `Total de despesas no mês: R$ ${r.totalDespesas.toFixed(2)} (${r.numLancamentosDespesa} lançamento(s)).`,
    `Saldo do mês (receitas − despesas): R$ ${r.saldo.toFixed(2)}.`,
    r.taxaPoupancaPct != null
      ? `Taxa de poupança do mês: ${r.taxaPoupancaPct.toFixed(1)}% da renda.`
      : "Taxa de poupança: não calculável (sem receita cadastrada no mês).",
    categorias ? `Categorias de despesa que mais pesaram: ${categorias}.` : "",
    "Sempre que fizer sentido, inclua: quanto ainda está disponível pra gastar mantendo o saldo positivo, e o que aconteceria se o ritmo atual de gasto se mantivesse até o fim do mês (só como leitura qualitativa dos números acima, não um cálculo novo).",
    pergunta
      ? `Pergunta específica do usuário, responda considerando os dados acima: "${pergunta}"`
      : 'O usuário só pediu um resumo geral (ex.: "como estão minhas finanças").',
  ]
    .filter(Boolean)
    .join("\n");
}

export const resumoFinanceiroIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pergunta: string; resumo: ResumoFinanceiroContexto }) => input)
  .handler(async ({ data, context }): Promise<{ texto: string; erro?: string }> => {
    const apiKey = chaveOpenAI();
    if (!apiKey) {
      return { texto: "", erro: "IA não configurada (faltando OPENAI_API_KEY no servidor)." };
    }
    const pergunta = data.pergunta.trim();
    if (pergunta.length > LIMITE_CARACTERES_TEXTO_IA) {
      return {
        texto: "",
        erro: `Pergunta muito longa (máx. ${LIMITE_CARACTERES_TEXTO_IA} caracteres) — resuma em poucas palavras.`,
      };
    }
    const avisoModo = await verificarModoIA(context, "texto");
    if (avisoModo) return { texto: "", erro: avisoModo };
    const avisoCota = await verificarCotaIA(context.userId);
    if (avisoCota) return { texto: "", erro: avisoCota };

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
          temperature: 0.3,
          messages: [{ role: "system", content: montarPromptResumo(data.resumo, pergunta) }],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const corpo = await res.text().catch(() => "");
        return {
          texto: "",
          erro: `IA indisponível (${res.status}). ${corpo.slice(0, 200)}`.trim(),
        };
      }

      const payload = await res.json();
      const texto: string | undefined = payload?.choices?.[0]?.message?.content?.trim();
      if (!texto) return { texto: "", erro: "IA respondeu vazio. Tente de novo." };
      return { texto };
    } catch {
      return { texto: "", erro: "Falha ao contatar a IA (rede ou tempo esgotado)." };
    }
  });
