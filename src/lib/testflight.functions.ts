import { createServerFn } from "@tanstack/react-start";

/** Convite público do beta do Control ALL no TestFlight (limite de 50 testadores). */
export const LINK_TESTFLIGHT = "https://testflight.apple.com/join/Fn7GVnY1";

export type VagasBeta = { estado: "abertas" | "lotado" | "desconhecido"; limite: number };

let cache: { v: VagasBeta; ate: number } | null = null;

/**
 * A Apple não publica o número de vagas restantes; a página do convite só diz se o beta ainda aceita
 * testadores ou se está cheio. Lemos essa página (guardada por 10 minutos) e mostramos o estado.
 */
export const vagasDoBeta = createServerFn({ method: "GET" }).handler(async (): Promise<VagasBeta> => {
  if (cache && cache.ate > Date.now()) return cache.v;
  let v: VagasBeta = { estado: "desconhecido", limite: 50 };
  try {
    const r = await fetch(LINK_TESTFLIGHT, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const html = (await r.text()).toLowerCase();
      if (/beta is full|isn.t accepting any new testers|não está aceitando|no longer accepting/.test(html)) v = { estado: "lotado", limite: 50 };
      else if (/testflight|join the beta|start testing/.test(html)) v = { estado: "abertas", limite: 50 };
    }
  } catch {
    // sem rede ou bloqueio: mostra "não foi possível verificar"
  }
  cache = { v, ate: Date.now() + 10 * 60 * 1000 };
  return v;
});
