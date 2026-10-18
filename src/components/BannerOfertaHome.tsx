import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { obterBannerOferta } from "@/lib/banner-oferta.functions";
import { rastrearEvento } from "@/lib/funil-cliente";

function formatarRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const dias = Math.floor(total / 86_400);
  const horas = Math.floor((total % 86_400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const hms = [horas, minutos, segundos].map((n) => String(n).padStart(2, "0")).join(":");
  return dias > 0 ? `${dias}d ${hms}` : hms;
}

/**
 * Faixa de destaque no topo da home com contador até a data fim gravada pelo admin.
 * Só renderiza no cliente, para não divergir do servidor na primeira pintura.
 */
export function BannerOfertaHome() {
  const obter = useServerFn(obterBannerOferta);
  const { data } = useQuery({
    queryKey: ["banner-oferta-home"],
    queryFn: () => obter(),
    staleTime: 60_000,
  });
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!data?.exibir || !data.fim || agora === null) return null;
  const restante = Date.parse(data.fim) - agora;
  if (restante <= 0) return null;

  return (
    <section
      aria-label="Oferta por tempo limitado"
      className="bg-gradient-to-r from-primary via-primary to-emerald-500 text-primary-foreground shadow-md"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Timer className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide opacity-90">{data.titulo}</p>
            <p className="font-mono text-3xl font-extrabold tabular-nums sm:text-4xl">
              {formatarRestante(restante)}
            </p>
            <p className="text-sm opacity-90">{data.texto}</p>
          </div>
        </div>
        <Button asChild size="lg" variant="secondary" className="h-12 font-semibold">
          <Link
            to="/entrar"
            search={{ criar: true }}
            onClick={() => rastrearEvento("clique_cadastrar", { caminho: "/#banner-oferta" })}
          >
            {data.botao} <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
