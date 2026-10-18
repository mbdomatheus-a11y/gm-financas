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
 * Banner de oferta com contador até a data fim gravada pelo admin.
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
      className="border-b bg-primary/10"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Timer className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              Oferta por tempo limitado. Termina em{" "}
              <span className="tabular-nums text-primary">{formatarRestante(restante)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Crie sua conta grátis e garanta acesso completo.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="font-semibold">
          <Link
            to="/entrar"
            search={{ criar: true }}
            onClick={() => rastrearEvento("clique_cadastrar", { caminho: "/#banner-oferta" })}
          >
            Criar conta grátis <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
