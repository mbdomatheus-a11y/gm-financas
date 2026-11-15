import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

/**
 * Atalho do iPhone (15/11/2026): lança um gasto ou uma receita sem abrir o app.
 * POST /api/atalho  ·  Authorization: Bearer <código pessoal>  ·  corpo JSON { "texto": "mercado 85 no nubank" }
 * (também aceita texto puro). Responde em texto simples, que o app Atalhos mostra na tela.
 * O código é gerado em Configurações > Atalho do iPhone; o banco guarda só o hash (tabela atalho_tokens).
 */
const texto = (msg: string, status = 200) =>
  new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function somarMeses(iso: string, n: number): string {
  const [a = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const ultimo = new Date(a, m - 1 + n + 1, 0).getDate();
  const x = new Date(a, m - 1 + n, Math.min(d, ultimo));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export const Route = createFileRoute("/api/atalho")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!/^ca_[0-9a-f]{48}$/.test(token)) {
          return texto("Código do atalho inválido. Gere um novo em Configurações > Atalho do iPhone.", 401);
        }
        let entrada = "";
        const bruto = await request.text();
        try {
          const j = JSON.parse(bruto) as { texto?: unknown };
          entrada = typeof j?.texto === "string" ? j.texto : "";
        } catch {
          entrada = bruto;
        }
        entrada = entrada.replace(/\s+/g, " ").trim().slice(0, 300);
        if (!entrada) return texto("Diga o gasto. Exemplo: mercado 85 reais no Nubank.", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const hash = createHash("sha256").update(token).digest("hex");
        const { data: chave } = await db.from("atalho_tokens").select("user_id, usos").eq("token_hash", hash).maybeSingle();
        if (!chave) return texto("Código do atalho inválido ou trocado. Gere um novo em Configurações > Atalho do iPhone.", 401);
        const userId = chave.user_id as string;

        try {
          const { aplicarLimite } = await import("@/lib/rate-limit.server");
          await aplicarLimite(db, { rota: "atalho-lancamento", chave: userId, maxPorJanela: 30, janelaMinutos: 60 });
        } catch {
          return texto("Muitos lançamentos pelo atalho em pouco tempo. Tente de novo em alguns minutos.", 429);
        }

        const { data: perfil } = await db.from("profiles").select("nome, grupo_id, ativo").eq("id", userId).maybeSingle();
        if (!perfil?.grupo_id || perfil.ativo === false) return texto("Conta sem acesso. Entre no app para conferir.", 403);
        const grupoId = perfil.grupo_id as string;
        const nome = String(perfil.nome ?? "").trim() || "Compartilhado";

        const [{ data: cats }, { data: cartoes }, { data: bancos }] = await Promise.all([
          db.from("categorias").select("nome, tipo").eq("grupo_id", grupoId),
          db.from("cartoes").select("id, nome").eq("grupo_id", grupoId),
          db.from("bancos").select("id, nome").eq("grupo_id", grupoId),
        ]);
        const categorias = (cats ?? []) as { nome: string; tipo: string }[];
        const listaCartoes = (cartoes ?? []) as { id: string; nome: string }[];
        const listaBancos = (bancos ?? []) as { id: string; nome: string }[];

        const ia = await import("@/lib/lancamento-ia-nucleo.server");
        const { RascunhoIASchema } = await import("@/lib/lancamento-ia");
        const { textoNatural } = await import("@/lib/texto-natural");
        const apiKey = ia.chaveOpenAI();
        if (!apiKey) return texto("A IA não está disponível agora. Lance pelo app.", 503);
        const avisoCota = await ia.verificarCotaIA(userId);
        if (avisoCota) return texto(avisoCota, 429);

        const hoje = hojeSP();
        const contexto = {
          hoje,
          perfis: [nome],
          categoriasDespesa: categorias.filter((c) => c.tipo !== "receita").map((c) => c.nome),
          categoriasReceita: categorias.filter((c) => c.tipo === "receita").map((c) => c.nome),
          formasPagamento: [...listaCartoes.map((c) => c.nome), ...listaBancos.map((b) => b.nome)],
          usuarioAtual: nome,
        };
        let rascunho: any;
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: process.env["OPENAI_MODEL_TEXTO"] || "gpt-4o-mini",
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: ia.montarPrompt(contexto as any) },
                { role: "user", content: entrada },
              ],
            }),
            signal: AbortSignal.timeout(20000),
          });
          if (!res.ok) return texto("A IA não respondeu agora. Tente de novo ou lance pelo app.", 502);
          const j = await res.json();
          const parsed = RascunhoIASchema.safeParse(ia.extrairJson(j?.choices?.[0]?.message?.content ?? ""));
          if (!parsed.success) return texto("Não entendi. Diga algo como: mercado 85 reais no Nubank.", 422);
          rascunho = parsed.data;
        } catch {
          return texto("A IA demorou para responder. Tente de novo.", 504);
        }

        const valor = Number(rascunho.valor);
        if (!(valor > 0)) return texto("Faltou o valor. Diga algo como: mercado 85 reais.", 422);
        const tipo = rascunho.tipo === "receita" ? "receita" : "despesa";
        const descricao = textoNatural(rascunho.descricao || entrada).slice(0, 120);
        const data = typeof rascunho.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rascunho.data) ? rascunho.data : hoje;
        const doTipo = categorias.filter((c) => (tipo === "receita" ? c.tipo === "receita" : c.tipo !== "receita"));
        const categoria = doTipo.find((c) => semAcento(c.nome) === semAcento(String(rascunho.categoria ?? "")))?.nome ?? null;
        const pagamento = semAcento(String(rascunho.forma_pagamento ?? ""));
        const cartao = pagamento ? listaCartoes.find((c) => semAcento(c.nome) === pagamento || pagamento.includes(semAcento(c.nome))) : undefined;
        const banco = !cartao && pagamento ? listaBancos.find((b) => semAcento(b.nome) === pagamento || pagamento.includes(semAcento(b.nome))) : undefined;
        const observacoes = "Lançado pelo atalho do iPhone";

        if (tipo === "receita") {
          const { error } = await db.from("receitas").insert({
            descricao, observacoes, valor, moeda: "BRL", categoria: categoria ?? "Outros", data_recebimento: data,
            recorrente: false, responsavel: nome, grupo_id: grupoId, created_by: userId,
          });
          if (error) return texto("Não foi possível salvar. Lance pelo app.", 500);
        } else {
          const total = Number.isInteger(rascunho.parcelas) && rascunho.parcelas >= 1 && rascunho.parcelas <= 60 ? rascunho.parcelas : 1;
          const { data: despesa, error } = await db
            .from("despesas")
            .insert({
              descricao, observacoes, valor_total: valor, valor_total_centavos: Math.round(valor * 100), moeda: "BRL",
              categoria: categoria ?? "Categoria a confirmar", categoria_confirmada: !!categoria, tipo: "variavel",
              direcao: "debito", iof: false, data_compra: data, total_parcelas: total, data_primeira_parcela: data,
              origem: "manual", responsavel: nome, cartao_id: cartao?.id ?? null, banco_id: banco?.id ?? null,
              grupo_id: grupoId, created_by: userId, congelada: false, possivel_duplicidade: false,
              economia_conquistada: false, recorrencia_sem_prazo: false,
            })
            .select("id")
            .single();
          if (error || !despesa) return texto("Não foi possível salvar. Lance pelo app.", 500);
          const centavos = Math.round(valor * 100);
          const base = Math.floor(centavos / total);
          const linhas = Array.from({ length: total }, (_, n) => ({
            despesa_id: despesa.id, numero: n + 1, total, grupo_id: grupoId,
            valor: (n === total - 1 ? centavos - base * (total - 1) : base) / 100,
            moeda: "BRL", vencimento: somarMeses(data, n), paga: false,
          }));
          const { error: e2 } = await db.from("parcelas").insert(linhas);
          if (e2) {
            await db.from("despesas").delete().eq("id", despesa.id);
            return texto("Não foi possível salvar. Lance pelo app.", 500);
          }
        }
        await db.from("atalho_tokens").update({ ultimo_uso_em: new Date().toISOString(), usos: Number(chave.usos ?? 0) + 1 }).eq("user_id", userId);

        const partes = [`${tipo === "receita" ? "Receita" : "Gasto"} lançado: ${descricao}, ${brl(valor)}`];
        if (categoria) partes.push(categoria);
        if (cartao) partes.push(cartao.nome);
        return texto(`${partes.join(" · ")}.${categoria ? "" : " Confira a categoria no app."}`);
      },
    },
  },
});
