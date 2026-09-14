import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Sequência do "aceno" de marca: "Control" fica fixo, só o sufixo depois
// dele muda — vai ganhando um "+", depois "Tudo" (mostrando a tradução de
// "ALL"), depois some o "+ Tudo" e entra o "ALL" de verdade, formando
// "Control ALL". Cada estágio tem sua própria duração (o "ALL" final fica
// mais tempo visível, já que é o nome de verdade) e depois o ciclo reinicia
// em loop suave (fade), do jeito que foi pedido: "fique mudando na home de
// forma suave".
const ESTAGIOS: { texto: string; duracaoMs: number }[] = [
  { texto: "", duracaoMs: 1300 },
  { texto: "+", duracaoMs: 900 },
  { texto: "+ Tudo", duracaoMs: 1600 },
  { texto: "ALL", duracaoMs: 3200 },
];

const DURACAO_FADE_MS = 300;

export function BrandAnimado({ className }: { className?: string }) {
  const [indice, setIndice] = useState(0);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const estagio = ESTAGIOS[indice]!;
    const timeoutEsconder = setTimeout(() => {
      setVisivel(false);
    }, estagio.duracaoMs);

    return () => clearTimeout(timeoutEsconder);
  }, [indice]);

  useEffect(() => {
    if (visivel) return;
    const timeoutProximo = setTimeout(() => {
      setIndice((i) => (i + 1) % ESTAGIOS.length);
      setVisivel(true);
    }, DURACAO_FADE_MS);
    return () => clearTimeout(timeoutProximo);
  }, [visivel]);

  return (
    <h1
      className={cn(
        "select-none text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl",
        className,
      )}
    >
      Control{" "}
      <span
        className={cn(
          "inline-block text-primary transition-opacity ease-in-out",
          visivel ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${DURACAO_FADE_MS}ms` }}
      >
        {ESTAGIOS[indice]!.texto || " "}
      </span>
    </h1>
  );
}
