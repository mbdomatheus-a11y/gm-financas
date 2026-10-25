import { useQuery } from "@tanstack/react-query";
import { Apple, ExternalLink, Laptop, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LINK_TESTFLIGHT, vagasDoBeta } from "@/lib/testflight.functions";
import { cn } from "@/lib/utils";

const LOJA_TESTFLIGHT = "https://apps.apple.com/br/app/testflight/id899247664";

/** Convite do beta do app para Apple (TestFlight). Só no site: no app o próprio app já é o beta. */
export function BetaTestFlight({ className }: { className?: string }) {
  const [aberto, setAberto] = useState(false);
  const { data } = useQuery({ queryKey: ["vagas-beta-testflight"], queryFn: () => vagasDoBeta(), staleTime: 10 * 60 * 1000 });
  const estado = data?.estado ?? "desconhecido";
  const rotulo = estado === "abertas" ? "Vagas abertas" : estado === "lotado" ? "Vagas esgotadas" : "Vagas: não foi possível verificar agora";
  const cor =
    estado === "abertas"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : estado === "lotado"
        ? "bg-red-500/15 text-red-700 dark:text-red-400"
        : "bg-muted text-muted-foreground";
  return (
    <>
      <section className={cn("native:hidden flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center", className)}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Apple className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Control All Beta</p>
          <p className="text-xs text-muted-foreground">Teste o app no iPhone, iPad e Mac pelo TestFlight. Limite de {data?.limite ?? 50} testadores.</p>
          <span className={cn("mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", cor)}>{rotulo}</span>
        </div>
        <Button className="shrink-0" onClick={() => setAberto(true)}>
          Quero testar
        </Button>
      </section>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Control All Beta no TestFlight</DialogTitle>
            <DialogDescription>Siga os passos para instalar e testar o app.</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Baixe o app <strong>TestFlight</strong> (gratuito, da Apple) na App Store.{" "}
              <a className="inline-flex items-center gap-1 text-primary underline" href={LOJA_TESTFLIGHT} target="_blank" rel="noreferrer">
                Abrir na App Store <ExternalLink className="size-3" />
              </a>
            </li>
            <li>Volte aqui e toque em <strong>Abrir convite</strong> (ou abra o link direto no aparelho em que vai testar).</li>
            <li>No TestFlight, toque em <strong>Aceitar</strong> e depois em <strong>Instalar</strong>.</li>
            <li>Abra o Control ALL, entre com a sua conta e use normalmente. Os avisos de novas versões chegam pelo próprio TestFlight.</li>
          </ol>
          <div className="flex flex-wrap gap-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Smartphone className="size-4" /> iPhone</span>
            <span className="inline-flex items-center gap-1.5"><Tablet className="size-4" /> iPad</span>
            <span className="inline-flex items-center gap-1.5"><Laptop className="size-4" /> Mac com chip Apple (macOS 13 ou mais novo)</span>
          </div>
          <p className="text-xs text-muted-foreground">O beta aceita até 50 pessoas. Se o convite disser que está cheio, tente de novo mais tarde.</p>
          <Button asChild>
            <a href={LINK_TESTFLIGHT} target="_blank" rel="noreferrer">
              Abrir convite <ExternalLink className="size-4" />
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
