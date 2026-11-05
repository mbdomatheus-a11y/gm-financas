import { CelularPrevisao } from "@/components/landing/VitrineDispositivos";

/**
 * "Por dentro da Previsão" (05/11/2026): composição parada, no mesmo estilo da tela de login.
 * Celular inclinado com a Previsão do mês e legendas de vidro flutuando devagar em volta.
 * Não depende da rolagem. Dados de exemplo. A flutuação some com "reduzir movimento".
 */
const LEGENDAS = [
  { titulo: "Seu ciclo de verdade", texto: "Do dia em que o salário cai até a próxima virada.", pos: "left-0 top-[4%]", atraso: "0s" },
  { titulo: "Quanto dá para gastar por dia", texto: "Receitas menos contas, faturas e caixinhas.", pos: "right-0 top-[18%]", atraso: "1.2s" },
  { titulo: "Faturas abertas entram estimadas", texto: "Pela média dos últimos meses, até você informar o total.", pos: "left-[2%] top-[58%]", atraso: "2.4s" },
  { titulo: "Lance falando ou escrevendo", texto: "A IA monta o lançamento e você confere.", pos: "right-[2%] top-[72%]", atraso: "3.6s" },
];

export function VistaExplodida() {
  return (
    <section aria-labelledby="por-dentro" className="overflow-hidden bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-lg font-semibold text-primary">Por dentro da Previsão</p>
          <h2 id="por-dentro" className="mt-3 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Cada número tem um motivo.
          </h2>
        </div>

        {/* Computador e tablet: celular no centro com legendas flutuando */}
        <div className="relative mx-auto mt-16 hidden h-[560px] max-w-4xl md:block">
          <CelularPrevisao className="absolute left-1/2 top-0 w-[240px] -translate-x-1/2 -rotate-[5deg]" />
          {LEGENDAS.map((l) => (
            <div
              key={l.titulo}
              className={`entrar-flutua absolute w-64 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_24px_48px_-24px_rgba(14,26,43,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10 ${l.pos}`}
              style={{ animationDelay: l.atraso }}
            >
              <p className="text-[15px] font-bold tracking-tight">{l.titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{l.texto}</p>
            </div>
          ))}
        </div>

        {/* Celular: aparelho e lista abaixo */}
        <div className="mt-12 md:hidden">
          <CelularPrevisao className="mx-auto w-[220px] -rotate-[4deg]" />
          <ul className="mt-10 space-y-3">
            {LEGENDAS.map((l) => (
              <li key={l.titulo} className="rounded-2xl bg-background p-4">
                <p className="font-bold tracking-tight">{l.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{l.texto}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">Exemplo ilustrativo</p>
      </div>
    </section>
  );
}
