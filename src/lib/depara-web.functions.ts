import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORIAS_PADRAO, LISTA_CATEGORIAS } from "@/lib/categorizacao";

export interface ResultadoIdentificacaoWeb {
  categoria: string;
  subcategoria: string | null;
  explicacao: string;
  confianca: "alta" | "media" | "baixa";
}

function chaveOpenAI(): string | null {
  const chave = process.env["OPENAI_API_KEY"];
  return chave && chave.trim() ? chave.trim() : null;
}

/**
 * Heurística de fallback baseada em segmentos comerciais conhecidos do Brasil
 */
function identificarPorHeuristica(termo: string): ResultadoIdentificacaoWeb {
  const t = termo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/\b(posto|shell|ipiranga|petrobras|br branca|combustivel|gasolina|etanol|auto posto)\b/.test(t)) {
    return {
      categoria: "Veículo",
      subcategoria: "Combustível",
      explicacao: "Posto de combustíveis automotivos e serviços de abastecimento.",
      confianca: "alta",
    };
  }
  if (/\b(supermercado|hipermercado|mercado|carrefour|pao de acucar|extra|assai|atacadão|atacadao|dia|mambo|zaffari|sonda)\b/.test(t)) {
    return {
      categoria: "Mercado",
      subcategoria: "Supermercado",
      explicacao: "Comércio varejista ou atacadista de alimentos e itens essenciais.",
      confianca: "alta",
    };
  }
  if (/\b(farmacia|drogaria|raia|drogasil|pacheco|sao paulo|panvel|medicamento|droga)\b/.test(t)) {
    return {
      categoria: "Saúde",
      subcategoria: "Farmácia",
      explicacao: "Drogaria ou farmácia de medicamentos e produtos de saúde.",
      confianca: "alta",
    };
  }
  if (/\b(restaurante|churrascaria|pizzaria|bar|hamburgueria|burger|lanchonete|mcdonald|subway|bobs|bk|ifood|habib)\b/.test(t)) {
    return {
      categoria: "Alimentação",
      subcategoria: "Restaurante",
      explicacao: "Alimentação, refeição, delivery ou consumo gastronômico.",
      confianca: "alta",
    };
  }
  if (/\b(uber|99app|99 pop|99 taxi|cabify|indrive)\b/.test(t)) {
    return {
      categoria: "Transporte",
      subcategoria: "Transporte por aplicativo",
      explicacao: "Serviço de transporte individual de passageiros por aplicativo.",
      confianca: "alta",
    };
  }
  if (/\b(netflix|spotify|amazon prime|disney|hbo|max|apple tv|youtube premium)\b/.test(t)) {
    return {
      categoria: "Assinaturas / Serviços digitais",
      subcategoria: "Streaming",
      explicacao: "Serviço de assinatura de streaming de vídeo ou música.",
      confianca: "alta",
    };
  }
  if (/\b(pet|petz|cobasi|veterinari|racao)\b/.test(t)) {
    return {
      categoria: "Pets",
      subcategoria: "Pet shop",
      explicacao: "Produtos, alimentação ou serviços veterinários para animais de estimação.",
      confianca: "alta",
    };
  }
  if (/\b(zara|riachuelo|renner|c&a|marisa|shein|hering|centauro|roupa|calcado|calcados|sapat)\b/.test(t)) {
    return {
      categoria: "Vestuário / Calçados",
      subcategoria: "Roupas",
      explicacao: "Comércio de moda, vestuário, calçados ou acessórios.",
      confianca: "alta",
    };
  }
  if (/\b(claro|vivo|tim|oi|net|embratel)\b/.test(t)) {
    return {
      categoria: "Telefonia / Internet",
      subcategoria: "Celular",
      explicacao: "Serviços de telecomunicações, dados móveis ou banda larga.",
      confianca: "alta",
    };
  }
  if (/\b(enel|cpfl|light|sabesp|comgas|copel|cemig)\b/.test(t)) {
    return {
      categoria: "Moradia / Casa",
      subcategoria: "Energia",
      explicacao: "Concessionária de serviços públicos essenciais de moradia (energia/água/gás).",
      confianca: "alta",
    };
  }

  return {
    categoria: "Outros",
    subcategoria: "Não identificada",
    explicacao: "Estabelecimento não localizado diretamente nas regras heurísticas locais.",
    confianca: "baixa",
  };
}

/**
 * Server Function: Identifica a atividade econômica e classifica nas 22 macrocategorias
 * oficiais do Control ALL via OpenAI com fallback heurístico.
 */
export const identificarEstabelecimentoWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { termo: string }) => {
    const termo = (data.termo ?? "").trim();
    if (!termo) throw new Error("Informe o nome do estabelecimento para pesquisar.");
    return { termo: termo.slice(0, 150) };
  })
  .handler(async ({ data }): Promise<ResultadoIdentificacaoWeb> => {
    const { termo } = data;
    const apiKey = chaveOpenAI();

    if (!apiKey) {
      return identificarPorHeuristica(termo);
    }

    try {
      const categoriasValidas = LISTA_CATEGORIAS.filter((c) => c !== "Categoria a confirmar");
      const subcategoriasMap = Object.entries(CATEGORIAS_PADRAO).map(
        ([cat, subs]) => `• ${cat}: ${subs.join(", ")}`
      ).join("\n");

      const prompt = `Você é um especialista em conciliação contábil e segmentos de mercado varejista brasileiro (CNAE).
Analise o nome ou razão social/fantasia do seguinte estabelecimento comercial:
"${termo}"

Determine a qual das 22 macrocategorias oficiais do sistema ele pertence e qual subcategoria mais adequada:
Lista oficial de macrocategorias e subcategorias permitidas:
${subcategoriasMap}

REGRAS RÍGIDAS:
1. O campo "categoria" DEVE ser OBRIGATORIAMENTE uma das 22 macrocategorias listadas acima, exatamente com a mesma grafia.
2. O campo "subcategoria" deve ser uma das subcategorias listadas para aquela macrocategoria, ou null se nenhuma couber.
3. No campo "explicacao", dê uma frase curta explicando que tipo de negócio é este estabelecimento (ex: "Drogaria São Paulo: Rede de comércio varejista farmacêutico").
4. No campo "confianca", use "alta", "media" ou "baixa".
5. Responda ESTRITAMENTE em formato JSON puro, sem blocos markdown.`;

      const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Você é um classificador financeiro de estabelecimentos comerciais brasileiros em formato JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (!resposta.ok) {
        return identificarPorHeuristica(termo);
      }

      const json = await resposta.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return identificarPorHeuristica(termo);

      const parsed = JSON.parse(content);
      const categoriaEncontrada = categoriasValidas.find(
        (c) => c.toLowerCase() === (parsed.categoria ?? "").trim().toLowerCase()
      );

      if (!categoriaEncontrada) {
        return identificarPorHeuristica(termo);
      }

      const subcategoriasDaCat = CATEGORIAS_PADRAO[categoriaEncontrada] ?? [];
      const subEncontrada = subcategoriasDaCat.find(
        (s) => s.toLowerCase() === (parsed.subcategoria ?? "").trim().toLowerCase()
      ) ?? null;

      return {
        categoria: categoriaEncontrada,
        subcategoria: subEncontrada,
        explicacao: parsed.explicacao || `Estabelecimento identificado como ${categoriaEncontrada}.`,
        confianca: parsed.confianca === "alta" || parsed.confianca === "media" ? parsed.confianca : "media",
      };
    } catch {
      return identificarPorHeuristica(termo);
    }
  });
