import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "financas_ocultar_valores";
const STORAGE_KEY_ITENS = "financas_ocultar_valores_itens";

type OverridesPorItem = Record<string, boolean>;

function lerOverrides(): OverridesPorItem {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITENS);
    return raw ? (JSON.parse(raw) as OverridesPorItem) : {};
  } catch {
    return {};
  }
}

/**
 * Item 4 (backlog 2026-09-27): controla a exibição de valores em R$ em duas
 * camadas — um botão GLOBAL (oculta tudo) e, por caixa/card individual, um
 * "olho" que pode forçar aquele item específico a ficar oculto OU visível,
 * mesmo quando o global diz o contrário (regra do usuário: "as vezes quero
 * mostrar minha despesa e não minhas receitas — clico no olho da receita e
 * ela fica oculta e deixo apenas a despesa"). Tudo persistido no navegador
 * (mesmo padrão já usado aqui antes de existir override por item).
 *
 * `itemId` é uma chave estável por caixa (ex.: "receitas", "despesas",
 * "economia-conquistada"). Sem `itemId`, o hook se comporta como antes
 * (só global) — mantém compatibilidade com quem já usava só `ocultarValores`.
 */
export function usePrivacidadeValores(itemId?: string) {
  const [ocultarValores, setOcultarValores] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [overrides, setOverrides] = useState<OverridesPorItem>(() => lerOverrides());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(ocultarValores));
    } catch {
      // Ignora falhas de localStorage
    }
  }, [ocultarValores]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITENS, JSON.stringify(overrides));
    } catch {
      // Ignora falhas de localStorage
    }
  }, [overrides]);

  const toggle = useCallback(() => {
    setOcultarValores((prev) => !prev);
  }, []);

  // Override específico deste item, se `itemId` foi passado e existir um
  // valor salvo para ele; senão cai no valor global.
  const override = itemId !== undefined ? overrides[itemId] : undefined;
  const ocultoNesteItem = override !== undefined ? override : ocultarValores;

  const toggleItem = useCallback(() => {
    if (itemId === undefined) return;
    setOverrides((prev) => {
      const atual = prev[itemId] !== undefined ? prev[itemId] : ocultarValores;
      return { ...prev, [itemId]: !atual };
    });
  }, [itemId, ocultarValores]);

  const limparOverrideItem = useCallback(() => {
    if (itemId === undefined) return;
    setOverrides((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, [itemId]);

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
  };
}
