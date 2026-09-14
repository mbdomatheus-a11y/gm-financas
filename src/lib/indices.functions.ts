import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração com o SGS (Sistema Gerenciador de Séries Temporais) do Banco
 * Central — API pública, sem necessidade de chave: https://api.bcb.gov.br
 *
 * Códigos de série confirmados na documentação oficial do BCB (FAQ "Price
 * Indices", bcb.gov.br) e cruzados com fontes independentes:
 *   - IPCA (mensal): 433
 *   - INCC-DI (mensal): 192
 *   - IGP-DI (mensal): 190
 *   - IGP-M (mensal): 189
 *   - CDI (diário, % a.d.): 12
 *   - Selic (diário, % a.d.): 11
 *   - CDI acumulada no mês, anualizada (% a.a., base 252): 4391
 *   - Selic acumulada no mês, anualizada (% a.a.): 4390
 */

export type CodigoIndiceReajuste = "IPCA" | "INCC-DI" | "IGP-DI" | "IGP-M" | "CDI" | "SELIC";

interface IndiceInfo {
  codigo: CodigoIndiceReajuste;
  label: string;
  serieSgs: number;
  frequencia: "mensal" | "diaria";
}

export const INDICES_REAJUSTE: IndiceInfo[] = [
  { codigo: "IPCA", label: "IPCA (inflação oficial)", serieSgs: 433, frequencia: "mensal" },
  { codigo: "IGP-M", label: "IGP-M (comum em aluguéis)", serieSgs: 189, frequencia: "mensal" },
  { codigo: "IGP-DI", label: "IGP-DI", serieSgs: 190, frequencia: "mensal" },
  { codigo: "INCC-DI", label: "INCC-DI (construção civil)", serieSgs: 192, frequencia: "mensal" },
  { codigo: "CDI", label: "CDI", serieSgs: 12, frequencia: "diaria" },
  { codigo: "SELIC", label: "Selic", serieSgs: 11, frequencia: "diaria" },
];

const MESES_POR_PERIODICIDADE: Record<string, number> = { mensal: 1, semestral: 6, anual: 12 };

async function buscarSerieBacen(
  serieSgs: number,
  ultimosN: number,
): Promise<{ data: string; valor: number }[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieSgs}/dados/ultimos/${ultimosN}?formato=json`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Não foi possível conectar à API do Banco Central. Tente novamente.");
  }
  if (!res.ok) {
    throw new Error(`O Banco Central respondeu com erro (${res.status}) para a série ${serieSgs}.`);
  }
  const json = (await res.json()) as { data: string; valor: string }[];
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error("O Banco Central não retornou dados para essa série.");
  }
  return json.map((d) => ({
    data: bacenDataParaIso(d.data),
    valor: Number(String(d.valor).replace(",", ".")),
  }));
}

/** Converte a data no formato "dd/MM/yyyy" (padrão do SGS/BCB) para ISO "yyyy-MM-dd". */
function bacenDataParaIso(data: string): string {
  const [dia, mes, ano] = data.split("/");
  if (!dia || !mes || !ano) return data;
  return `${ano}-${mes}-${dia}`;
}

/** Composição de taxas percentuais: (Π(1 + v/100) − 1) × 100. */
function acumular(valores: number[]): number {
  const fator = valores.reduce((acc, v) => acc * (1 + v / 100), 1);
  return (fator - 1) * 100;
}

/**
 * Busca o valor acumulado (composto) de um índice para a periodicidade de
 * reajuste escolhida (ex.: IPCA acumulado dos últimos 12 meses). Usado para
 * preencher automaticamente o percentual de reajuste de despesas/receitas.
 */
export const buscarValorIndice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        indice: z.enum(["IPCA", "INCC-DI", "IGP-DI", "IGP-M", "CDI", "SELIC"]),
        periodicidade: z.enum(["mensal", "semestral", "anual"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const info = INDICES_REAJUSTE.find((i) => i.codigo === data.indice);
    if (!info) throw new Error("Índice desconhecido.");
    const meses = MESES_POR_PERIODICIDADE[data.periodicidade] ?? 12;

    if (info.frequencia === "mensal") {
      const serie = await buscarSerieBacen(info.serieSgs, meses);
      const percentual = acumular(serie.map((s) => s.valor));
      return {
        percentual: Number(percentual.toFixed(4)),
        dataBase: serie.at(-1)?.data ?? null,
      };
    }

    // Índices diários (CDI/Selic): busca dias úteis suficientes para cobrir
    // o período, com folga, e acumula.
    const diasUteis = Math.ceil(meses * 22 * 1.2);
    const serie = await buscarSerieBacen(info.serieSgs, diasUteis);
    const percentual = acumular(serie.map((s) => s.valor));
    return {
      percentual: Number(percentual.toFixed(4)),
      dataBase: serie.at(-1)?.data ?? null,
    };
  });

/**
 * Taxa anual vigente (% a.a.) de CDI ou Selic, usada como base para projetar
 * o rendimento de investimentos atrelados a esses indexadores. Usa as séries
 * já anualizadas do BCB (acumulado do mês, anualizado por dias úteis/252),
 * evitando reimplementar a regra de contagem de dias úteis.
 */
export const buscarTaxaAnualVigente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ indice: z.enum(["CDI", "SELIC"]) }).parse(d))
  .handler(async ({ data }) => {
    const serieSgs = data.indice === "CDI" ? 4391 : 4390;
    const serie = await buscarSerieBacen(serieSgs, 1);
    const ultimo = serie.at(-1)!;
    return { percentualAnual: ultimo.valor, dataBase: ultimo.data };
  });
