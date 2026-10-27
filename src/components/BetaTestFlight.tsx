import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Apple, ExternalLink, Laptop, Smartphone, Tablet, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAvisoDispensado } from "@/lib/avisos-dispensados";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { registrarEventoUso } from "@/lib/registrar-uso";
import { LINK_TESTFLIGHT, vagasDoBeta } from "@/lib/testflight.functions";
import { cn } from "@/lib/utils";

const LOJA_TESTFLIGHT = "https://apps.apple.com/br/app/testflight/id899247664";

/** Maçã verde com brilho (27/10/2026): chama a atenção para o beta do app. */
export function MacaBeta({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-emerald-500 to-green-700 text-white shadow-[0_0_18px_rgba(16,185,129,0.65)] ring-2 ring-emerald-300/60",
        className,
      )}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" aria-hidden="true" />
      <span className="absolute left-2 top-1.5 h-2.5 w-4 rotate-[-25deg] rounded-full bg-white/50 blur-[1px]" aria-hidden="true" />
      <Apple className="relative size-5" aria-hidden="true" />
    </span>
  );
}

function useVagas() {
  const { data } = useQuery({ queryKey: ["vagas-beta-testflight"], queryFn: () => vagasDoBeta(), staleTime: 10 * 60 * 1000 });
  const estado = data?.estado ?? "desconhecido";
  const rotulo = estado === "abertas" ? "Vagas abertas" : estado === "lotado" ? "Vagas esgotadas" : "Vagas: não foi possível verificar agora";
  const cor =
    estado === "abertas"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : estado === "lotado"
        ? "bg-red-500/15 text-red-700 dark:text-red-400"
        : "bg-muted text-muted-foreground";
  return { limite: data?.limite ?? 50, rotulo, cor };
}

/** Passo a passo do TestFlight. */
export function InstrucoesBeta({ aberto, onOpenChange }: { aberto: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
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
        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
          <a href={LINK_TESTFLIGHT} target="_blank" rel="noreferrer" onClick={() => registrarEventoUso("aviso-beta/abriu-convite")}>
            Abrir convite <ExternalLink className="size-4" />
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Card do beta (o formato que aparece para o usuário). */
export function CardBeta({
  className,
  onQueroTestar,
  rodape,
  onFechar,
}: {
  className?: string;
  onQueroTestar: () => void;
  rodape?: React.ReactNode;
  onFechar?: () => void;
}) {
  const { limite, rotulo, cor } = useVagas();
  return (
    <section className={cn("relative rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-sm", className)}>
      {onFechar && (
        <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <MacaBeta />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Control All Beta</p>
          <p className="text-xs text-muted-foreground">Teste o app no iPhone, iPad e Mac pelo TestFlight. Limite de {limite} testadores.</p>
          <span className={cn("mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", cor)}>{rotulo}</span>
        </div>
        <Button className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700" onClick={onQueroTestar}>
          Quero testar
        </Button>
      </div>
      {rodape}
    </section>
  );
}

/** Card fixo do beta na Início do site. No app não aparece (lá o próprio app já é o beta). */
export function BetaTestFlight({ className }: { className?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <CardBeta
        className={cn("native:hidden", className)}
        onQueroTestar={() => {
          registrarEventoUso("aviso-beta/quero-testar");
          setAberto(true);
        }}
      />
      <InstrucoesBeta aberto={aberto} onOpenChange={setAberto} />
    </>
  );
}

/**
 * Aviso do beta que o admin dispara (27/10/2026). Aparece uma vez por sessão, no topo da tela,
 * para quem está no site (não no app). "Não mostrar mais" guarda na conta e vale até o admin
 * disparar uma rodada nova. Exibição, clique e dispensa entram no log de uso.
 */
export function AvisoBetaApp({ bloqueado = false, onVisibilityChange }: { bloqueado?: boolean; onVisibilityChange?: (v: boolean) => void }) {
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const { data: config } = useQuery({ queryKey: ["configuracao-acesso-publica"], queryFn: () => obterConfig(), staleTime: 60_000 });
  const { rodadaDispensada, carregando, dispensar } = useAvisoDispensado("beta");
  const [visivel, setVisivel] = useState(false);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const [instrucoes, setInstrucoes] = useState(false);
  const rodada = Number(config?.rodada_aviso_beta ?? 0);

  useEffect(() => {
    if (bloqueado || carregando || !config || rodada <= 0 || rodadaDispensada >= rodada) return;
    if ((window as unknown as { __controlAllApp?: unknown }).__controlAllApp) return;
    try {
      if (sessionStorage.getItem(`control-all-aviso-beta-${rodada}`)) return;
      sessionStorage.setItem(`control-all-aviso-beta-${rodada}`, "1");
    } catch {
      // sem armazenamento: mostra mesmo assim
    }
    setVisivel(true);
    registrarEventoUso("aviso-beta/exibido");
  }, [bloqueado, carregando, config, rodada, rodadaDispensada]);

  useEffect(() => onVisibilityChange?.(visivel), [visivel, onVisibilityChange]);

  function fechar() {
    if (naoMostrar) {
      void dispensar(rodada);
      registrarEventoUso("aviso-beta/nao-mostrar-mais");
    } else registrarEventoUso("aviso-beta/fechou");
    setVisivel(false);
  }

  return (
    <>
      {visivel && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-xl animate-in fade-in slide-in-from-top-4">
          <CardBeta
            className="shadow-xl"
            onFechar={fechar}
            onQueroTestar={() => {
              registrarEventoUso("aviso-beta/quero-testar");
              if (naoMostrar) void dispensar(rodada);
              setVisivel(false);
              setInstrucoes(true);
            }}
            rodape={
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={naoMostrar} onCheckedChange={(v) => setNaoMostrar(v === true)} />
                Não mostrar este aviso de novo
              </label>
            }
          />
        </div>
      )}
      <InstrucoesBeta aberto={instrucoes} onOpenChange={setInstrucoes} />
    </>
  );
}
