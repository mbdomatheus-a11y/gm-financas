import { useEffect, useState } from "react";

/**
 * Esconde elementos fixos ao rolar a página para baixo e os mostra de novo ao rolar para cima,
 * como em um app nativo. Usa rolagem passiva e atualiza no máximo uma vez por quadro.
 * Sempre visível perto do topo.
 */
export function useOcultarNaRolagem(limiar = 80, sensibilidade = 6): boolean {
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let ultimo = window.scrollY;
    let ocultoAtual = false;
    let agendado = false;

    const atualizar = () => {
      agendado = false;
      const y = Math.max(0, window.scrollY);
      const delta = y - ultimo;
      if (Math.abs(delta) < sensibilidade) return;
      ultimo = y;
      if (delta > 0 && y > limiar && !ocultoAtual) {
        ocultoAtual = true;
        setOculto(true);
      } else if ((delta < 0 || y <= limiar) && ocultoAtual) {
        ocultoAtual = false;
        setOculto(false);
      }
    };

    const aoRolar = () => {
      if (!agendado) {
        agendado = true;
        window.requestAnimationFrame(atualizar);
      }
    };

    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, [limiar, sensibilidade]);

  return oculto;
}
