import { useCallback, useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

const STORAGE_KEY = "financas_ocultar_valores";
const STORAGE_KEY_ITENS = "financas_ocultar_valores_itens";
const SYNC_EVENT = "financas_privacidade_sync";

type OverridesPorItem = Record<string, boolean>;

function lerGlobal(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function lerOverrides(): OverridesPorItem {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITENS);
    return raw ? (JSON.parse(raw) as OverridesPorItem) : {};
  } catch {
    return {};
  }
}

function notificarMudanca() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  }
}

/**
 * Item 4 (backlog 2026-09-27): controla a exibição de valores em R$ em duas
 * camadas — um botão GLOBAL (oculta tudo) e, por caixa/card individual, um
 * "olho" que pode forçar aquele item específico a ficar oculto OU visível,
 * mesmo quando o global diz o contrário.
 *
 * Sincronizado reativamente entre todas as telas e componentes no mesmo instante.
 */
export function usePrivacidadeValores(itemId?: string) {
  const [ocultarValores, setOcultarValoresState] = useState<boolean>(() => lerGlobal());
  const [overrides, setOverridesState] = useState<OverridesPorItem>(() => lerOverrides());

  // Escuta mudanças de outras instâncias (ex: botão do header alterando, e páginas reagindo)
  useEffect(() => {
    function onSync() {
      setOcultarValoresState(lerGlobal());
      setOverridesState(lerOverrides());
    }
    if (typeof window === "undefined") return;
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  const setOcultarValores = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setOcultarValoresState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      notificarMudanca();
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    setOcultarValores((prev) => !prev);
  }, [setOcultarValores]);

  // Override específico deste item, se `itemId` foi passado e existir um
  // valor salvo para ele; senão cai no valor global.
  const override = itemId !== undefined ? overrides[itemId] : undefined;
  const ocultoNesteItem = override !== undefined ? override : ocultarValores;

  const toggleItem = useCallback(() => {
    if (itemId === undefined) return;
    setOverridesState((prev) => {
      const atual = prev[itemId] !== undefined ? prev[itemId] : lerGlobal();
      const next = { ...prev, [itemId]: !atual };
      try {
        localStorage.setItem(STORAGE_KEY_ITENS, JSON.stringify(next));
      } catch {}
      notificarMudanca();
      return next;
    });
  }, [itemId]);

  const limparOverrideItem = useCallback(() => {
    if (itemId === undefined) return;
    setOverridesState((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      try {
        localStorage.setItem(STORAGE_KEY_ITENS, JSON.stringify(next));
      } catch {}
      notificarMudanca();
      return next;
    });
  }, [itemId]);

  /** Formata um valor numérico em BRL ou mascara como 'R$ ••••••' se a privacidade estiver ativa */
  const formatar = useCallback(
    (valor: number | null | undefined, customFormatter: (v: number) => string = formatBRL) => {
      if (valor == null) return "—";
      if (ocultoNesteItem) return "R$ ••••••";
      return customFormatter(valor);
    },
    [ocultoNesteItem],
  );

  return {
    /** Preferência global (o botão "olho" do cabeçalho). */
    ocultarValores,
    toggle,
    setOcultarValores,
    /** Verdadeiro se ESTE item (dado o `itemId`) deve mostrar valores ocultos — já considera o override, com fallback pro global. */
    ocultoNesteItem,
    /** Alterna só este item, independente do global. */
    toggleItem,
    /** Remove o override deste item, voltando a seguir o global. */
    limparOverrideItem,
    /** true quando este item tem um override salvo (diferente do global). */
    temOverride: override !== undefined,
    /** Helper para mascarar valor se oculto */
    formatar,
  };
}
