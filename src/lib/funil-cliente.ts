import { supabase } from "@/integrations/supabase/client";
import { registrarEventoFunil, type EVENTOS_FUNIL } from "@/lib/funil.functions";

/**
 * Lado do navegador do funil (2026-10-17). A sessão anônima é a mesma do log de acessos
 * (sessionStorage "control-all-sessao-acesso"); a origem (utm) da primeira página fica
 * guardada na sessão para os eventos seguintes saberem de onde a pessoa veio.
 */
const CHAVE_SESSAO = "control-all-sessao-acesso";
const CHAVE_ORIGEM = "control-all-origem-acesso";

export function sessaoAcesso(): { sessao: string | null; primeira: boolean } {
  try {
    let sessao = sessionStorage.getItem(CHAVE_SESSAO);
    let primeira = false;
    if (!sessao) {
      sessao = crypto.randomUUID();
      sessionStorage.setItem(CHAVE_SESSAO, sessao);
      primeira = true;
    }
    return { sessao, primeira };
  } catch {
    return { sessao: null, primeira: false };
  }
}

export function origemAcesso(): { utmSource: string | null; utmCampaign: string | null; utmMedium: string | null } {
  const params = new URLSearchParams(window.location.search);
  const atual = {
    utmSource: params.get("utm_source"),
    utmCampaign: params.get("utm_campaign"),
    utmMedium: params.get("utm_medium"),
  };
  try {
    if (atual.utmSource) {
      sessionStorage.setItem(CHAVE_ORIGEM, JSON.stringify(atual));
      return atual;
    }
    const salvo = sessionStorage.getItem(CHAVE_ORIGEM);
    if (salvo) return JSON.parse(salvo);
  } catch {
    /* sem armazenamento */
  }
  return atual;
}

export async function tokenAtual(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Registra um evento do funil sem nunca atrapalhar a tela. */
export function rastrearEvento(evento: (typeof EVENTOS_FUNIL)[number], extras?: { valor?: number; caminho?: string }) {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const { sessao } = sessaoAcesso();
      const { utmSource, utmCampaign } = origemAcesso();
      await registrarEventoFunil({
        data: {
          evento,
          sessao,
          caminho: extras?.caminho ?? window.location.pathname,
          valor: extras?.valor ?? null,
          utmSource,
          utmCampaign,
          token: await tokenAtual(),
        },
      });
    } catch {
      /* ignora */
    }
  })();
}
