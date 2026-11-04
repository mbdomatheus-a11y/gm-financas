import { competenciaAtual, toBRL } from "@/lib/format";
import { lancamentosPorCompetencias, somarMeses } from "@/lib/recorrencia";

/**
 * Sugestões de economia (03/11/2026). Regras fixas, sem IA: olha os últimos 6 meses e aponta cobranças
 * recorrentes que vale revisar (assinaturas, seguros, telefonia, taxas) e cobranças que subiram.
 * O texto é neutro ("vale revisar"): não é recomendação financeira personalizada.
 */
export type TipoSugestao = "assinatura" | "seguro" | "telefonia" | "taxa" | "aumento";

export type SugestaoEconomia = {
  id: string;
  tipo: TipoSugestao;
  titulo: string;
  texto: string;
  mensal: number;
  anual: number;
  /** Texto para filtrar a tela Despesas ("Ver lançamentos"). */
  busca: string;
};

const MESES_ANALISE = 6;

const RE_ASSINATURA =
  /NETFLIX|SPOTIFY|DISNEY|HBO|MAX COM|PRIME|YOUTUBE|GLOBOPLAY|DEEZER|APPLE COM|ICLOUD|GOOGLE ONE|GOOGLE STORAGE|ADOBE|CHATGPT|OPENAI|CLAUDE|LOVABLE|SMILES|CLUBE|PARAMOUNT|CRUNCHYROLL|DUOLINGO|AUDIBLE|KINDLE|MICROSOFT|DROPBOX|NOTION/;
const RE_CAT_ASSINATURA = /ASSINATURA|TECNOLOGIA \/ IA|SERVICOS DIGITAIS|STREAMING/;
const RE_SEGURO = /SEGURO/;
const RE_CAT_TELEFONIA = /TELEFONIA|INTERNET/;
const RE_TAXA = /ANUIDADE|JUROS|IOF|MULTA|TARIFA|MORA/;
const RE_CAT_TAXA = /TAXA|JUROS|ANUIDADE/;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = (t: string) => semAcento(t).toUpperCase().replace(/[^A-Z\/ ]/g, " ").replace(/\s+/g, " ").trim();
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

export function sugerirEconomias(despesas: any[], cotacao: any, hoje: Date = new Date()): SugestaoEconomia[] {
  const atual = competenciaAtual(hoje);
  const meses: string[] = [];
  for (let i = MESES_ANALISE - 1; i >= 0; i--) meses.push(somarMeses(atual, -i));
  const lancs = lancamentosPorCompetencias(despesas, meses);

  type Grupo = { rotulo: string; categoria: string; porMes: Map<string, number> };
  const grupos = new Map<string, Grupo>();
  for (const p of lancs as any[]) {
    const d = p.despesa;
    if (!d || d.direcao === "credito" || d.economia_conquistada) continue;
    if (Number(d.total_parcelas ?? 1) > 1) continue; // parcelado tem fim: não é cobrança recorrente
    const bruto = String(d.estabelecimento || d.descricao || "").trim();
    const chave = normalizar(bruto).replace(/\//g, " ").replace(/\s+/g, " ").trim();
    if (chave.length < 3) continue;
    const g = grupos.get(chave) ?? { rotulo: bruto, categoria: "", porMes: new Map<string, number>() };
    g.categoria = String(d.categoria ?? g.categoria ?? "");
    g.porMes.set(p.competencia, (g.porMes.get(p.competencia) ?? 0) + toBRL(Number(p.valor), p.moeda ?? d.moeda, cotacao));
    grupos.set(chave, g);
  }

  const out: SugestaoEconomia[] = [];
  for (const [chave, g] of grupos) {
    const ordenados = [...g.porMes.entries()].filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b));
    const valores = ordenados.map(([, v]) => v);
    if (valores.length < 2) continue;
    const cat = normalizar(g.categoria);
    const mensal = media(valores);
    const anual = mensal * 12;
    const estavel = Math.max(...valores) / Math.min(...valores) <= 1.3;
    const rotulo = g.rotulo.length > 38 ? `${g.rotulo.slice(0, 38)}…` : g.rotulo;
    const base = {
      mensal: Math.round(mensal * 100) / 100,
      anual: Math.round(anual * 100) / 100,
      busca: g.rotulo.split(/\s+/).slice(0, 3).join(" "),
    };

    const ehSeguro = RE_SEGURO.test(chave) || RE_SEGURO.test(cat);
    const ehAssinatura = RE_ASSINATURA.test(chave) || RE_CAT_ASSINATURA.test(cat);
    const ehTelefonia = RE_CAT_TELEFONIA.test(cat);
    const ehTaxa = RE_TAXA.test(chave) || RE_CAT_TAXA.test(cat);

    if (ehSeguro) {
      out.push({ id: `seguro:${chave}`, tipo: "seguro", titulo: `Seguro: ${rotulo}`, texto: `${reais(mensal)} por mês (${reais(anual)} por ano). Vale comparar cotações e revisar a cobertura na renovação.`, ...base });
    } else if (ehAssinatura && valores.length >= 3 && estavel) {
      out.push({ id: `assinatura:${chave}`, tipo: "assinatura", titulo: `Assinatura: ${rotulo}`, texto: `${reais(mensal)} por mês (${reais(anual)} por ano). Vale revisar se você ainda usa ou se existe um plano mais barato.`, ...base });
    } else if (ehTelefonia && valores.length >= 3) {
      out.push({ id: `telefonia:${chave}`, tipo: "telefonia", titulo: `Telefonia e internet: ${rotulo}`, texto: `${reais(mensal)} por mês em média (${reais(anual)} por ano). Vale comparar planos e pedir condições melhores à operadora.`, ...base });
    } else if (ehTaxa && valores.length >= 3) {
      const anuidade = /ANUIDADE/.test(chave);
      out.push({
        id: `taxa:${chave}`,
        tipo: "taxa",
        titulo: anuidade ? `Anuidade: ${rotulo}` : `Taxa: ${rotulo}`,
        texto: anuidade
          ? `${reais(mensal)} por mês (${reais(anual)} por ano). Vale perguntar ao banco sobre isenção ou outra categoria de cartão.`
          : `${reais(mensal)} por mês em média nos últimos meses (${reais(anual)} por ano). Vale entender a origem da cobrança.`,
        ...base,
      });
    } else if (valores.length >= 4 && !/MERCADO|ALIMENTACAO|TRANSPORTE|COMPRAS|SAUDE|PETS/.test(cat)) {
      // Aumento: cobrança que vinha estável e subiu mais de 10% no último mês.
      const anteriores = valores.slice(0, -1);
      const ultimo = valores[valores.length - 1]!;
      const mediaAnt = media(anteriores);
      const estavelAnt = Math.max(...anteriores) / Math.min(...anteriores) <= 1.15;
      if (estavelAnt && ultimo > mediaAnt * 1.1) {
        const pct = Math.round((ultimo / mediaAnt - 1) * 100);
        out.push({
          id: `aumento:${chave}`,
          tipo: "aumento",
          titulo: `Aumentou: ${rotulo}`,
          texto: `Passou de ${reais(mediaAnt)} para ${reais(ultimo)} (+${pct}%). Vale conferir se o reajuste foi combinado.`,
          ...base,
          mensal: Math.round((ultimo - mediaAnt) * 100) / 100,
          anual: Math.round((ultimo - mediaAnt) * 1200) / 100,
        });
      }
    }
  }
  return out.sort((a, b) => b.anual - a.anual);
}
