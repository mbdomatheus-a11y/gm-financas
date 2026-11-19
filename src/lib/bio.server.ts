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

