import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { definirCicloDoUsuario } from "@/lib/format";
import { useSession } from "./useAuthData";
import { useRegraCiclo } from "./useRegraCiclo";

export type Preferencias = {
  user_id: string;
  tema: string;
  paleta: string;
  fonte: string;
  layout_menu: string;
  /** Item 5 do backlog 2026-09-27: dia de virada do "mês do sistema" (1-28), ou null para mês calendário normal. */
  dia_virada: number | null;
  /** 30/10/2026: receita recebida a partir deste dia (até a virada) conta para o próximo ciclo. null = pela data. */
  receitas_proximo_ciclo_dia: number | null;
  /** Bloco 7 (plano-mega-2026-09-14.md): destaca a soma do módulo Veículo no card "Veículo" da Início. */
  destacar_veiculo_inicio: boolean;
  /** Widgets da tela Início (ordem, tamanho). null = layout automático. */
  home_widgets: { id: string; tamanho: "p" | "m" | "g" }[] | null;
  /** Idioma escolhido pelo usuário. null = segue o país/navegador. */
  idioma: string | null;
  /** Como nomear categorias em gráficos: só a macro, só a subcategoria ou o nome completo. */
  exibicao_categoria: ExibicaoCategoria;
  /**
   * Regras de saldo (07/11/2026, migration 20261107160000_regras_saldo.sql). Enquanto a migration
   * não roda, as colunas não existem e valem os padrões abaixo.
   */
  /** Transferências entre contas entram nos totais de saldo. */
  somar_transferencias: boolean;
  /** Pagamento de fatura conta como despesa (além das compras do cartão). */
  somar_pagamento_fatura: boolean;
  /** Mostra a fatura aberta (ainda não fechada) estimada nas previsões. */
  mostrar_fatura_aberta: boolean;
  /** Aportes e resgates de investimentos entram no saldo. */
  somar_investimentos: boolean;
};

/** Chaves das regras de saldo (colunas novas, podem não existir no banco ainda). */
export const CHAVES_REGRAS_SALDO = [
  "somar_transferencias",
  "somar_pagamento_fatura",
  "mostrar_fatura_aberta",
  "somar_investimentos",
] as const;
export type ChaveRegraSaldo = (typeof CHAVES_REGRAS_SALDO)[number];

/** Coluna desconhecida pelo banco (PGRST204 ou mensagem do PostgREST/Postgres). */
function colunaAusente(error: any): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /column .* (does not exist|of 'preferencias_usuario')|could not find the .* column/i.test(String(error.message ?? ""));
}

export type ExibicaoCategoria = "categoria" | "subcategoria" | "completo";

export const DEFAULT_PREFS: Omit<Preferencias, "user_id"> = {
  tema: "claro",
  paleta: "azul",
  fonte: "Plus Jakarta Sans",
  layout_menu: "lateral",
  dia_virada: null,
  receitas_proximo_ciclo_dia: null,
  destacar_veiculo_inicio: false,
  home_widgets: null,
  idioma: null,
  exibicao_categoria: "categoria",
  somar_transferencias: false,
  somar_pagamento_fatura: false,
  mostrar_fatura_aberta: true,
  somar_investimentos: false,
};

/** Último dia de virada aplicado nesta sessão (undefined = ainda não carregou). */
let viradaAplicada: number | null | undefined;

export function usePreferencias() {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["preferencias", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preferencias_usuario")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { user_id: user!.id, ...DEFAULT_PREFS } as Preferencias;
      // Colunas ainda não criadas (regras de saldo) ficam com o padrão.
      const linha = data as Partial<Preferencias>;
      const regras = Object.fromEntries(
        CHAVES_REGRAS_SALDO.map((k) => [k, typeof linha[k] === "boolean" ? linha[k] : DEFAULT_PREFS[k]]),
      ) as Pick<Preferencias, ChaveRegraSaldo>;
      const prefs = { ...(data as unknown as Preferencias), ...regras };
      // Aplica o ciclo ANTES de a tela receber as preferências: os totais já saem do período certo.
      definirCicloDoUsuario(prefs.dia_virada ?? null, prefs.receitas_proximo_ciclo_dia ?? null);
      return prefs;
    },
  });

  const save = useMutation({
    mutationFn: async (values: Partial<Omit<Preferencias, "user_id">>) => {
      const next = { ...DEFAULT_PREFS, ...(query.data ?? {}), ...values, user_id: user!.id };
      // Cast pontual: os tipos gerados ainda não conhecem receitas_proximo_ciclo_dia nem as regras de saldo.
      const { error } = await supabase.from("preferencias_usuario").upsert(next as any);
      if (error && colunaAusente(error)) {
        // Migration das regras de saldo pendente: salva o resto sem as colunas novas.
        if (CHAVES_REGRAS_SALDO.some((k) => k in values)) {
          throw new Error("As regras de saldo ainda não estão disponíveis. Tente mais tarde.");
        }
        const semRegras: Record<string, unknown> = { ...next };
        for (const k of CHAVES_REGRAS_SALDO) delete semRegras[k];
        const segunda = await supabase.from("preferencias_usuario").upsert(semRegras as any);
        if (segunda.error) throw segunda.error;
        return next;
      }
      if (error) throw error;
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferencias"] }),
  });

  // Mês do sistema: aplica o dia de virada em todo o cálculo. Se mudou, recarrega as consultas financeiras
  // para que os totais já calculados sejam refeitos com a regra nova.
  // 08/11/2026: a regra do ciclo do GRUPO (regra_ciclo_grupo) vale no lugar da virada pessoal. Sem regra
  // (ou com a migration pendente), segue a virada antiga das preferências.
  const ciclo = useRegraCiclo();
  const diaGrupo = ciclo.regra?.dia_virada ?? null;
  useEffect(() => {
    if (!query.data) return;
    const novo = diaGrupo ?? query.data.dia_virada ?? null;
    const valido = novo && novo >= 1 && novo <= 28 ? novo : null;
    definirCicloDoUsuario(query.data.dia_virada ?? null, query.data.receitas_proximo_ciclo_dia ?? null);
    // Rodada 2 (07/11/2026): na primeira carga NÃO refaz as consultas (era o que baixava tudo de novo,
    // 2 a 4 vezes). Os totais são calculados na tela, e as telas esperam as preferências (useFinancasProntas).
    // Só uma troca feita pelo usuário depois força a releitura.
    if (!ciclo.carregado) return;
    if (viradaAplicada !== undefined && viradaAplicada !== valido) {
      qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "preferencias" && q.queryKey[0] !== "regra-ciclo-grupo" });
    }
    viradaAplicada = valido;
  }, [query.data, qc, diaGrupo, ciclo.carregado]);

  const prefs = useMemo<Preferencias>(() => {
    const base = query.data ?? { user_id: "", ...DEFAULT_PREFS };
    return diaGrupo ? { ...base, dia_virada: diaGrupo, receitas_proximo_ciclo_dia: null } : base;
  }, [query.data, diaGrupo]);

  return { prefs, save, pronto: (query.isSuccess || query.isError) && ciclo.carregado };
}

export function useApplyPreferencias() {
  const { prefs } = usePreferencias();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-palette", prefs.paleta);
    root.style.setProperty("--app-font", `"${prefs.fonte}"`);

    const apply = (dark: boolean) => root.classList.toggle("dark", dark);
    if (prefs.tema === "automatico") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const listener = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
    apply(prefs.tema === "escuro");
    return;
  }, [prefs.paleta, prefs.fonte, prefs.tema]);
}
