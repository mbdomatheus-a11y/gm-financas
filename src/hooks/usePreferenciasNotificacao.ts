import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./useAuthData";

/**
 * Preferências de notificação (07/11/2026). Tabela preferencias_notificacao
 * (migration 20261107120000). Enquanto a migration não roda, devolve os padrões
 * e marca tabelaPendente para a tela avisar sem quebrar.
 */
export const LEMBRETES_CHAVES = [
  "despesa_perto_vencer",
  "revisar_faturas",
  "receita_a_receber",
  "limite_perto",
  "meta_sem_aporte",
  "revisar_transacoes",
  "dicas_economia",
  "garantia_vencendo",
  "veiculo_manutencao",
  "lista_compras",
  "habito_lancar",
] as const;

export type LembreteChave = (typeof LEMBRETES_CHAVES)[number];
export type Lembretes = Record<LembreteChave, boolean>;

export type PreferenciasNotificacao = {
  receber_todas: boolean;
  canal_push: boolean;
  canal_email: boolean;
  silencio_ativo: boolean;
  /** "HH:MM" */
  silencio_inicio: string;
  /** "HH:MM" */
  silencio_fim: string;
  lembretes: Lembretes;
};

export const LEMBRETES_PADRAO: Lembretes = Object.fromEntries(
  LEMBRETES_CHAVES.map((k) => [k, true]),
) as Lembretes;

export const PREFERENCIAS_NOTIFICACAO_PADRAO: PreferenciasNotificacao = {
  receber_todas: true,
  canal_push: true,
  canal_email: true,
  silencio_ativo: false,
  silencio_inicio: "22:00",
  silencio_fim: "08:00",
  lembretes: LEMBRETES_PADRAO,
};

const db = () => supabase as any;

const paraMinutos = (hhmmTexto: string): number | null => {
  const m = /^(\d{2}):(\d{2})/.exec(hhmmTexto);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Lembretes locais do app (07/11/2026): pode agendar este lembrete?
 * - receber_todas ou canal_push desligado: nenhum lembrete no celular.
 * - tipo com chave desligada em lembretes: não agenda. tipo null = sem chave correspondente (só as regras gerais).
 * - quando ("YYYY-MM-DDTHH:mm", hora local do aparelho) dentro do silêncio: não agenda.
 *   Intervalo que cruza a meia-noite (ex.: 22:00 a 08:00) é aceito.
 */
export function lembreteLiberado(
  prefs: PreferenciasNotificacao,
  tipo: LembreteChave | null,
  quando?: string,
): boolean {
  if (!prefs.receber_todas || !prefs.canal_push) return false;
  if (tipo && prefs.lembretes[tipo] === false) return false;
  if (prefs.silencio_ativo && quando) {
    const i = paraMinutos(prefs.silencio_inicio);
    const f = paraMinutos(prefs.silencio_fim);
    const agora = paraMinutos(quando.slice(11, 16));
    if (i !== null && f !== null && agora !== null && i !== f) {
      const dentro = i < f ? agora >= i && agora < f : agora >= i || agora < f;
      if (dentro) return false;
    }
  }
  return true;
}

function tabelaAusente(error: any) {
  const code = error?.code;
  return code === "42P01" || code === "PGRST205";
}

const hhmm = (v: unknown, padrao: string) =>
  typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : padrao;

function normalizar(row: any): PreferenciasNotificacao {
  const p = PREFERENCIAS_NOTIFICACAO_PADRAO;
  if (!row) return p;
  const brutos = row.lembretes && typeof row.lembretes === "object" ? row.lembretes : {};
  const lembretes = { ...LEMBRETES_PADRAO };
  for (const k of LEMBRETES_CHAVES) if (typeof brutos[k] === "boolean") lembretes[k] = brutos[k];
  return {
    receber_todas: row.receber_todas ?? p.receber_todas,
    canal_push: row.canal_push ?? p.canal_push,
    canal_email: row.canal_email ?? p.canal_email,
    silencio_ativo: row.silencio_ativo ?? p.silencio_ativo,
    silencio_inicio: hhmm(row.silencio_inicio, p.silencio_inicio),
    silencio_fim: hhmm(row.silencio_fim, p.silencio_fim),
    lembretes,
  };
}

export function usePreferenciasNotificacao() {
  const { user } = useSession();
  const qc = useQueryClient();
  const chave = ["preferencias-notificacao", user?.id];

  const query = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    queryFn: async (): Promise<{ prefs: PreferenciasNotificacao; tabelaPendente: boolean }> => {
      const { data, error } = await db()
        .from("preferencias_notificacao")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) {
        if (tabelaAusente(error)) return { prefs: PREFERENCIAS_NOTIFICACAO_PADRAO, tabelaPendente: true };
        throw error;
      }
      return { prefs: normalizar(data), tabelaPendente: false };
    },
  });

  const salvar = useMutation({
    mutationFn: async (proximas: PreferenciasNotificacao) => {
      if (!user?.id) throw new Error("Entre de novo para salvar.");
      const { error } = await db()
        .from("preferencias_notificacao")
        .upsert(
          { user_id: user.id, ...proximas, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) {
        if (tabelaAusente(error)) throw new Error("As preferências ainda não estão disponíveis. Tente mais tarde.");
        throw error;
      }
      return proximas;
    },
    onMutate: async (proximas) => {
      await qc.cancelQueries({ queryKey: chave });
      const anterior = qc.getQueryData(chave);
      qc.setQueryData(chave, (velho: any) => ({ tabelaPendente: velho?.tabelaPendente ?? false, prefs: proximas }));
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior !== undefined) qc.setQueryData(chave, ctx.anterior);
    },
  });

  return {
    prefs: query.data?.prefs ?? PREFERENCIAS_NOTIFICACAO_PADRAO,
    tabelaPendente: query.data?.tabelaPendente ?? false,
    carregando: query.isLoading,
    salvar: salvar.mutateAsync,
    salvando: salvar.isPending,
  };
}
