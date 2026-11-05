import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Item = { icon: React.ComponentType<{ className?: string }>; titulo: string; texto: string; detalhes: readonly string[] };

/**
 * Carrossel 3D dos módulos (05/11/2026). Os cartões ficam num círculo e sempre de frente
 * para quem lê; os de trás aparecem menores, através do vidro dos da frente. Gira devagar
 * sozinho, pausa ao passar o mouse ou focar, dá para arrastar e há setas para teclado.
 * Com "reduzir movimento" ligado não gira sozinho.
 */
export function CarrosselModulos({ itens }: { itens: readonly Item[] }) {
  const n = Math.max(itens.length, 1);
  const passo = 360 / n;
  const [angulo, setAngulo] = useState(0);
  const [suave, setSuave] = useState(false);
  const pausado = useRef(false);
  const arraste = useRef<{ x: number; a: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let antes = performance.now();
    const tick = (agora: number) => {
      const dt = Math.min(agora - antes, 64);
      antes = agora;
      if (!pausado.current && !arraste.current) setAngulo((a) => a - dt * 0.008);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const girar = (dir: 1 | -1) => {
    setSuave(true);
    setAngulo((a) => Math.round((a + dir * passo) / passo) * passo);
    window.setTimeout(() => setSuave(false), 650);
  };

  const raio = `clamp(170px, ${Math.max(n, 4) * 5.2}vw, ${Math.max(n, 4) * 62}px)`;
  const frente = ((Math.round(-angulo / passo) % n) + n) % n;

  return (
    <div
      className="relative select-none"
      onMouseEnter={() => (pausado.current = true)}
      onMouseLeave={() => (pausado.current = false)}
      onFocusCapture={() => (pausado.current = true)}
      onBlurCapture={() => (pausado.current = false)}
    >
      <div
        className="relative mx-auto h-[400px] cursor-grab touch-pan-y active:cursor-grabbing sm:h-[440px]"
        style={{ perspective: "1400px" }}
        onPointerDown={(e) => {
          arraste.current = { x: e.clientX, a: angulo };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!arraste.current) return;
          setAngulo(arraste.current.a + (e.clientX - arraste.current.x) * 0.35);
        }}
        onPointerUp={() => (arraste.current = null)}
        onPointerCancel={() => (arraste.current = null)}
      >
        <ul className="absolute inset-0" style={{ transformStyle: "preserve-3d" }} aria-label="Módulos do Control ALL">
          {itens.map(({ icon: Icon, titulo, texto, detalhes }, i) => {
            const teta = ((i * passo + angulo) * Math.PI) / 180;
            const z = Math.cos(teta); // 1 = frente, -1 = fundo
            const x = Math.sin(teta);
            const escala = 0.72 + (z + 1) * 0.14;
            return (
              <li
                key={titulo}
                aria-hidden={i !== frente}
                className="absolute left-1/2 top-1/2 w-[min(82vw,300px)]"
                style={{
                  transform: `translate(-50%, -50%) translate3d(calc(${x} * ${raio}), 0, calc(${z} * ${raio} - ${raio})) scale(${escala})`,
                  zIndex: Math.round((z + 1) * 50),
                  opacity: 0.45 + (z + 1) * 0.275,
                  transition: suave ? "transform 600ms cubic-bezier(.2,.7,.2,1), opacity 600ms" : undefined,
                }}
              >
                <article
                  className="relative isolate flex h-[340px] flex-col overflow-hidden rounded-[2rem] border border-white/60 p-7 shadow-[0_30px_60px_-30px_rgba(14,26,43,0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10"
                >
                  {/* fundo: sólido na frente, vidro nos de trás */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-card"
                    style={{ opacity: z > 0.55 ? 0.97 : 0.35 + Math.max(z, -1) * 0.25 + 0.25 }}
                  />
                  <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-5 text-2xl font-extrabold tracking-[-0.02em]">{titulo}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{texto}</p>
                  <ul className="mt-auto space-y-1.5 pt-4 text-sm text-muted-foreground">
                    {detalhes.slice(0, 3).map((d) => (
                      <li key={d} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        <span className="line-clamp-1">{d}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => girar(1)}
          aria-label="Módulo anterior"
          className="grid size-11 place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="min-w-40 text-center text-sm font-medium text-muted-foreground">
          {itens[frente]?.titulo}
        </p>
        <button
          type="button"
          onClick={() => girar(-1)}
          aria-label="Próximo módulo"
          className="grid size-11 place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
