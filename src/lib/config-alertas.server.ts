/**
 * Configuração dos alertas do sistema (14/11/2026). Lê public.config_alertas (migration
 * 20261114110000). Se a tabela ainda não existe, usa os padrões de alertas-catalogo.ts, que repetem o
 * comportamento anterior. Ver docs/alertas.md.
 */
import { CATALOGO_ALERTAS, itemCatalogo, type ConfigAlerta } from "@/lib/alertas-catalogo";
import { diaBrasilia, minutosAgoraBrasilia } from "@/lib/push.server";

export type MapaConfig = { porTipo: Map<string, ConfigAlerta>; daTabela: boolean };

let cache: { em: number; valor: MapaConfig } | null = null;

export function padroesDoCatalogo(): Map<string, ConfigAlerta> {
  return new Map(CATALOGO_ALERTAS.map((c) => [c.tipo, { tipo: c.tipo, ...c.padrao }]));
}

/** Configuração atual (cache de 60 s por instância). */
export async function carregarConfigAlertas(db: any, semCache = false): Promise<MapaConfig> {
  if (!semCache && cache && Date.now() - cache.em < 60_000) return cache.valor;
  const porTipo = padroesDoCatalogo();
  let daTabela = false;
  try {
    const { data, error } = await db.from("config_alertas").select("*");
    if (!error) {
      daTabela = true;
      for (const r of data ?? []) porTipo.set(r.tipo, { ...r, canais: Array.isArray(r.canais) ? r.canais : [] });
    }
  } catch {
    /* tabela pendente: padrões */
  }
  const valor = { porTipo, daTabela };
  cache = { em: Date.now(), valor };
  return valor;
}

/** Tipo da configuração a partir do tipo do aviso (mesma regra do gatilho do banco). */
export function alertaDoAviso(tipo: string, chave?: string | null): string {
  if (tipo === "parcela") return "parcela_vence";
  if (tipo === "parcela_fim") return "parcelas_terminam";
  if (tipo === "garantia") return "garantia_acabando";
  if (tipo === "fatura") return String(chave ?? "").includes(":fecha:") ? "fatura_fecha" : "fatura_vence";
  return tipo;
}

const ultimoDia = (iso: string) => {
  const [a, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(a!, m!, 0)).getUTCDate();
};

/**
 * É o momento de enviar o resumo de um tipo agregado? O cron roda de hora em hora: dispara na hora
 * configurada (Brasília) do dia certo. Semanal: dia_semana (0 domingo). Quinzenal: dia_mes e 15 dias
 * depois (padrão 1 e 16). Mensal: dia_mes (padrão 1; meses curtos usam o último dia).
 */
export function momentoDoResumo(cfg: ConfigAlerta, agora = new Date()): boolean {
  if (cfg.frequencia === "na_hora") return false;
  const hora = Math.floor(minutosAgoraBrasilia(agora) / 60);
  if (hora !== (cfg.hora ?? 9)) return false;
  const hoje = diaBrasilia(0, agora);
  const dia = Number(hoje.slice(8, 10));
  const fim = ultimoDia(hoje);
  if (cfg.frequencia === "diaria") return true;
  if (cfg.frequencia === "semanal") return new Date(`${hoje}T12:00:00Z`).getUTCDay() === (cfg.dia_semana ?? 1);
  if (cfg.frequencia === "quinzenal") {
    const d1 = (((cfg.dia_mes ?? 1) - 1) % 15) + 1;
    return dia === Math.min(d1, fim) || dia === Math.min(d1 + 15, fim);
  }
  return dia === Math.min(cfg.dia_mes ?? 1, fim);
}

/** Título do resumo: modelo do admin, senão o do catálogo. {n} vira a quantidade. */
export function tituloResumo(cfg: ConfigAlerta, n: number): string {
  const modelo = cfg.titulo_modelo?.trim() || itemCatalogo(cfg.tipo)?.resumo || "{n} avisos novos";
  return modelo.replace(/\{n\}/g, String(n));
}
