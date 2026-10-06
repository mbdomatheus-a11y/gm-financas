import { useEffect } from "react";

/**
 * Oculta TODOS os valores em R$ exibidos na tela (qualquer página) enquanto
 * `ativo` for verdadeiro, trocando-os por "R$ ••••••". Funciona sobre o texto
 * já renderizado (inclui gráficos), então vale para telas novas também. Ao
 * desativar, o texto original é restaurado. Não mexe em campos de digitação
 * nem em elementos marcados com `data-no-mask`.
 */
const RE_TESTE = /(?:R\$|US\$|€)\s*-?\d[\d.,]*/;
const RE_TROCA = /(?:R\$|US\$|€)\s*-?\d[\d.,]*/g;
const MASCARA = "R$ ••••••";

export function useMascaraValores(ativo: boolean) {
  useEffect(() => {
    if (!ativo || typeof document === "undefined") return;
    const estado = new Map<Text, { orig: string; mask: string }>();

    const pular = (n: Text) => {
      const el = n.parentElement;
      if (!el) return true;
      const t = el.tagName;
      if (t === "SCRIPT" || t === "STYLE" || t === "TEXTAREA" || t === "INPUT") return true;
      return !!el.closest("[data-no-mask]");
    };

    const mascarar = (n: Text) => {
      if (pular(n)) return;
      const v = n.nodeValue ?? "";
      const reg = estado.get(n);
      if (reg && v === reg.mask) return;
      if (!RE_TESTE.test(v)) {
        estado.delete(n);
        return;
      }
      const mask = v.replace(RE_TROCA, MASCARA);
      estado.set(n, { orig: v, mask });
      n.nodeValue = mask;
    };

    const varrer = (raiz: Node) => {
      if (raiz.nodeType === Node.TEXT_NODE) {
        mascarar(raiz as Text);
        return;
      }
      const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      let n = w.nextNode();
      while (n) {
        mascarar(n as Text);
        n = w.nextNode();
      }
    };

    varrer(document.body);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") mascarar(m.target as Text);
        else m.addedNodes.forEach((a) => varrer(a));
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      obs.disconnect();
      for (const [n, r] of estado) {
        if (n.isConnected && n.nodeValue === r.mask) n.nodeValue = r.orig;
      }
    };
  }, [ativo]);
}
