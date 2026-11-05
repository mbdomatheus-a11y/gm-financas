import { useEffect, useRef, useState } from "react";

/**
 * Vista explodida do app (05/11/2026): ao rolar, o celular com a Previsão do mês se inclina,
 * as camadas se separam em 3D com uma legenda cada e depois voltam a se juntar.
 * Dados de exemplo. Com "reduzir movimento", mostra a vista aberta parada.
 */
const TINTA = "#1D1D1F";
const CINZA = "#6E6E73";
const AZUL = "#1670B8";
const VERDE = "#1A8A4F";

const LEGENDAS = [
  { camada: 1, titulo: "Seu ciclo de verdade", texto: "Do dia em que o salário cai até a próxima virada." },
  { camada: 2, titulo: "Quanto dá para gastar por dia", texto: "Receitas menos contas fixas, faturas e caixinhas." },
  { camada: 3, titulo: "Faturas abertas entram estimadas", texto: "Pela média dos últimos meses, até você informar o total." },
  { camada: 4, titulo: "Lance falando ou escrevendo", texto: "A IA monta o lançamento e você confere antes de salvar." },
];

export function VistaExplodida() {
  const ref = useRef<HTMLElement>(null);
  const [abertura, setAbertura] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAbertura(1);
      return;
    }
    let raf = 0;
    const medir = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(total, 1)));
      // abre até a metade da rolagem, fica aberto um pouco e fecha no fim
      const a = p < 0.4 ? p / 0.4 : p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
      setAbertura(Math.max(0, Math.min(1, a)));
    };
    const aoRolar = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const t = abertura * abertura * (3 - 2 * abertura); // suavização
  const z = (i: number) => `translateZ(${i * 58 * t}px)`;

  return (
    <section ref={ref} aria-label="Como a Previsão do mês é montada" className="relative h-[260vh] bg-background">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-4">
        <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-2">
          <p className="text-lg font-semibold text-primary">Por dentro da Previsão</p>
          <h2 className="mt-2 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Cada número tem um motivo.
          </h2>
        </div>

        <div className="relative grid w-full max-w-5xl items-center gap-6 md:grid-cols-[1fr_1fr]">
          <div className="relative mx-auto h-[480px] w-[230px] sm:h-[540px] sm:w-[260px]" style={{ perspective: "1600px" }}>
            <div
              className="absolute inset-0"
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateX(${t * 52}deg) rotateZ(${t * -32}deg) scale(${1 - t * 0.12})`,
              }}
            >
              {/* 0. moldura */}
              <div className="absolute inset-0 rounded-[2.6rem] bg-[#1C1C1E] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.5)]" style={{ transform: z(0) }} />
              {/* 1. tela com ciclo */}
              <div className="absolute inset-[7px] rounded-[2.2rem] bg-[#F5F5F7] p-5 text-left" style={{ transform: z(1), color: TINTA }}>
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>9:41</span>
                  <span className="h-[18px] w-[78px] rounded-full bg-[#1C1C1E]" />
                  <span className="w-6" />
                </div>
                <p className="mt-5 text-[17px] font-extrabold">Previsão do mês</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: CINZA }}>
                  Novembro de 2026 <span className="rounded-full bg-white px-2 py-0.5" style={{ color: TINTA }}>ciclo 08/11 a 07/12</span>
                </p>
              </div>
              {/* 2. cartão com o valor por dia */}
              <div className="absolute inset-x-[22px] top-[120px] rounded-[1.4rem] bg-white p-4 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.2)]" style={{ transform: z(2), color: TINTA }}>
                <p className="text-[11px]" style={{ color: CINZA }}>Você pode gastar</p>
                <p className="text-[40px] font-extrabold leading-none tracking-[-0.04em] tabular-nums" style={{ color: VERDE }}>
                  R$ 114<span className="text-[22px]">,81</span>
                </p>
                <p className="text-[11px]" style={{ color: CINZA }}>por dia, com 24 dias restantes</p>
              </div>
              {/* 3. fatura estimada */}
              <div className="absolute inset-x-[22px] top-[262px] rounded-[1.1rem] bg-[#FFF6E5] px-4 py-3 text-[12px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]" style={{ transform: z(3), color: TINTA }}>
                <b>Inclui R$ 143 estimados</b>
                <span className="block" style={{ color: CINZA }}>de faturas ainda abertas</span>
              </div>
              {/* 4. botão lançar */}
              <div className="absolute inset-x-[22px] bottom-[26px] rounded-full py-3 text-center text-[14px] font-semibold text-white shadow-[0_12px_24px_-10px_rgba(22,112,184,0.6)]" style={{ transform: z(4), background: AZUL }}>
                + Lançar gasto
              </div>
            </div>
          </div>

          <ol className="mx-auto w-full max-w-sm space-y-5">
            {LEGENDAS.map((l, i) => {
              const aparece = Math.max(0, Math.min(1, t * 1.6 - i * 0.18));
              return (
                <li
                  key={l.titulo}
                  className="flex gap-4"
                  style={{ opacity: 0.15 + aparece * 0.85, transform: `translateX(${(1 - aparece) * 16}px)` }}
                >
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{l.camada}</span>
                  <div>
                    <p className="text-lg font-bold tracking-tight">{l.titulo}</p>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">{l.texto}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Exemplo ilustrativo</p>
      </div>
    </section>
  );
}
