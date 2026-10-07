import { Apple, Play, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

function Loja({ icone, pequeno, nome }: { icone: React.ReactNode; pequeno: string; nome: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border border-border bg-foreground px-4 py-2 text-background opacity-90"
      aria-label={`${nome}: em breve`}
    >
      {icone}
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wide opacity-80">{pequeno}</span>
        <span className="block text-sm font-semibold">{nome}</span>
      </span>
    </div>
  );
}

/** Aviso de que o aplicativo do Control ALL para celular está a caminho. */
export function AppEmBreve({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border bg-card p-6 text-center shadow-sm sm:flex-row sm:text-left",
        className,
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Smartphone className="size-6" />
      </span>
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Em breve</p>
        <h2 className="text-lg font-semibold">Um novo app para você</h2>
        <p className="text-sm text-muted-foreground">
          Estamos preparando o aplicativo do Control ALL para o seu celular.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Loja icone={<Apple className="size-6" />} pequeno="Em breve na" nome="App Store" />
        <Loja icone={<Play className="size-5" />} pequeno="Em breve no" nome="Google Play" />
      </div>
    </section>
  );
}
