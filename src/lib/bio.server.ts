import { getRequest } from "@tanstack/react-start/server";

/** Só no servidor (import-protection): dados da requisição para os eventos da página da bio. */
const decodificar = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

/** Dados da requisição para o evento (mesma regra de acessos_site_log). */
export function dadosDaRequisicao(metricas: boolean) {
  const h = getRequest().headers;
  const ua = h.get("user-agent") ?? "";
  const robo = /bot|crawl|spider|preview|headless|lighthouse|vercel|facebookexternalhit|whatsapp|telegram|slack/i.test(ua);
  const dispositivo = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "celular" : "computador";
  return {
    robo,
    campos: {
      ip: metricas ? h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null : null,
      cidade: metricas ? decodificar(h.get("x-vercel-ip-city")) : null,
      regiao: metricas ? decodificar(h.get("x-vercel-ip-country-region")) : null,
      pais: metricas ? h.get("x-vercel-ip-country") : null,
      user_agent: metricas ? ua.slice(0, 300) || null : null,
      dispositivo,
    },
  };
}


/**
 * 19/11/2026: busca o logo (ícone) do site do link e guarda em site_assets/bio/icones/. Roda só no servidor,
 * então quem visita a página não acessa serviço de terceiros. Devolve o caminho salvo ou null.
 */
export async function buscarIconeDoSite(db: any, linkId: string, url: string): Promise<string | null> {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const fontes = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
  ];
  for (const fonte of fontes) {
    try {
      const r = await fetch(fonte, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const tipo = r.headers.get("content-type") ?? "image/png";
      if (!tipo.startsWith("image/")) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length < 100 || bytes.length > 500_000) continue;
      const ext = tipo.includes("icon") ? "ico" : tipo.includes("svg") ? "svg" : tipo.includes("jpeg") ? "jpg" : "png";
      const path = `bio/icones/${linkId}-${Date.now()}.${ext}`;
      const { error } = await db.storage.from("site_assets").upload(path, bytes, { contentType: tipo, upsert: true });
      if (error) continue;
      return path;
    } catch {
      // tenta a próxima fonte
    }
  }
  return null;
}
