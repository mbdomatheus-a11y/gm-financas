import { createServerFn } from "@tanstack/react-start";
import { textoNatural } from "@/lib/texto-natural";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chaveOpenAI, extrairJson, montarPrompt, verificarCotaIA } from "@/lib/lancamento-ia-nucleo.server";
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
      // 15/11/2026: descrição no português do dia a dia (primeira maiúscula, sem CAIXA ALTA).
      return {
        ...parsed.data,
        descricao: parsed.data.descricao ? textoNatural(parsed.data.descricao) : parsed.data.descricao,
        observacao: parsed.data.observacao ? textoNatural(parsed.data.observacao) : parsed.data.observacao,
      };
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

  const comparativo = (r.mediaCategoriasAnteriores ?? [])
    .map((m) => {
      const atual = r.topCategoriasDespesa.find((c) => c.categoria === m.categoria)?.total ?? 0;
      return `- ${m.categoria}: este mês R$ ${atual.toFixed(2)} | média dos 3 meses anteriores R$ ${m.media.toFixed(2)}`;
    })
    .join("\n");

  const parcelamentos = (r.parcelamentosFuturos ?? [])
    .map(
      (p) =>
        `- ${p.descricao}: parcela de R$ ${p.valorParcela.toFixed(2)}, termina em ${p.mesFim} (faltam ${p.parcelasRestantes} de ${p.totalParcelas} parcelas)`,
    )
    .join("\n");

  const fixos = (r.gastosFixosRecorrentes ?? [])
    .map((g) => `- ${g.descricao} (${g.categoria}): R$ ${g.valor.toFixed(2)}`)
    .join("\n");

  const comprasPendentes = (r.itensListaCompras ?? [])
    .filter((c) => !c.comprado)
    .map((c) => `- ${c.nome} (${c.quantidade} un., categoria: ${c.categoria})`)
    .join("\n");

  const notas = (r.notasFiscais ?? [])
    .map(
      (n) =>
        `- ${n.descricao}${n.emitente ? ` (${n.emitente})` : ""}${n.valor ? `: R$ ${n.valor.toFixed(2)}` : ""}${n.garantiaAte ? ` · garantia até ${n.garantiaAte}` : ""}`,
    )
    .join("\n");

  return [
    "Você é o assistente inteligente do Control ALL, pessoal, ágil, prestativo e acolhedor.",
    "Você responde perguntas abertas do usuário sobre suas finanças, parcelamentos, assinaturas, compras e notas fiscais.",
    "REGRA DE OURO: baseie-se SOMENTE nos dados fornecidos abaixo — nunca invente ou deduza valores não existentes.",
    `Mês de referência: ${mesExtenso}.`,
    `Total de receitas no mês: R$ ${r.totalReceitas.toFixed(2)} (${r.numLancamentosReceita} lançamento(s)).`,
    `Total de despesas no mês: R$ ${r.totalDespesas.toFixed(2)} (${r.numLancamentosDespesa} lançamento(s)).`,
    ...(r.previstoNoFimDoCiclo != null ? [`Vai sobrar no fim do ciclo (número principal, use este para qualquer conta de sobra ou quanto pode gastar por dia): R$ ${r.previstoNoFimDoCiclo.toFixed(2)}.`] : []),
    `Em conta agora (já recebido menos já pago; não é a sobra): R$ ${r.saldo.toFixed(2)}.`,
    r.taxaPoupancaPct != null
      ? `Taxa de poupança do mês: ${r.taxaPoupancaPct.toFixed(1)}% da renda.`
      : "Taxa de poupança: não calculável (sem receita cadastrada no mês).",
    categorias ? `Categorias de despesa que mais pesaram: ${categorias}.` : "",
    comparativo ? `\nCOMPARATIVO POR CATEGORIA (use para apontar gasto acima do normal):\n${comparativo}` : "",
    r.lancamentosEmAberto
      ? `Lançamentos do mês ainda não pagos: ${r.lancamentosEmAberto.quantidade} (R$ ${r.lancamentosEmAberto.total.toFixed(2)}).`
      : "",
    parcelamentos ? `\nPARCELAMENTOS ATIVOS E MÊS DE TÉRMINO:\n${parcelamentos}` : "",
    fixos ? `\nGASTOS FIXOS E ASSINATURAS CADASTRADAS:\n${fixos}` : "",
    comprasPendentes
      ? `\nITENS PENDENTES NA LISTA DE COMPRAS:\n${comprasPendentes}`
      : "Lista de compras está vazia ou sem itens pendentes.",
    notas ? `\nNOTAS FISCAIS E GARANTIAS CADASTRADAS:\n${notas}` : "",
    "\nAÇÕES POSSÍVEIS:",
    'Se o usuário pedir para adicionar, incluir ou colocar itens na lista de compras (ex.: "adicione leite na lista", "coloque 2 sabonetes na lista de compras", "preciso comprar café"), confirme que adicionou e inclua OBRIGATORIAMENTE no final da mensagem a tag: [AÇÃO:ADICIONAR_COMPRA:{"nome":"Nome do item","quantidade":1}] (substituindo o nome e a quantidade conforme solicitado).',
    pergunta
      ? `\nPergunta do usuário: "${pergunta}"`
      : "O usuário pediu um resumo geral do mês (destaque o saldo, o que mais pesou e uma dica prática).",
  ]
    .filter(Boolean)
    .join("\n");
}

export const resumoFinanceiroIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { pergunta: string; resumo: ResumoFinanceiroContexto; contextoExtra?: string }) => input,
  )
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
          messages: [
            {
              role: "system",
              content:
                montarPromptResumo(data.resumo, pergunta) +
                // Dados extras montados pelo próprio site (não contam no limite da pergunta do usuário).
                (data.contextoExtra?.trim()
                  ? `\n\nDADOS ADICIONAIS DO USUÁRIO:\n${data.contextoExtra.trim().slice(0, 6000)}`
                  : ""),
            },
          ],
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
      let texto: string | undefined = payload?.choices?.[0]?.message?.content?.trim();
      if (!texto) return { texto: "", erro: "IA respondeu vazio. Tente de novo." };

      // Verifica se a IA disparou uma ação de adicionar na lista de compras
      const matchAcao = texto.match(/\[AÇÃO:ADICIONAR_COMPRA:(\{.*?\})\]/i);
      if (matchAcao && matchAcao[1]) {
        try {
          const item = JSON.parse(matchAcao[1]);
          if (item?.nome) {
            await (context.supabase.from("lista_compras") as any).insert({
              nome: String(item.nome).trim(),
              quantidade: Math.max(1, Number(item.quantidade) || 1),
              categoria: item.categoria || "mercado",
              lista: "compras",
              created_by: context.userId,
            });
          }
        } catch {
          // ignora falha de parse da ação
        }
        texto = texto.replace(/\[AÇÃO:ADICIONAR_COMPRA:\{.*?\}\]/gi, "").trim();
      }

      return { texto };
    } catch {
      return { texto: "", erro: "Falha ao contatar a IA (rede ou tempo esgotado)." };
    }
  });
