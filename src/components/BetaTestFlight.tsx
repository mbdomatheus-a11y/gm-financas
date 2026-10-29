import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Apple, ExternalLink, Laptop, Loader2, Smartphone, Tablet, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAvisoDispensado } from "@/lib/avisos-dispensados";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { registrarEventoUso } from "@/lib/registrar-uso";
import { LINK_TESTFLIGHT, vagasDoBeta } from "@/lib/testflight.functions";
import {
  LIMITE_BETA_ANDROID,
  LINK_GRUPO_ANDROID,
  LINK_TESTE_ANDROID,
  reservarVagaAndroid,
  vagasUsadasAndroid,
  type ResultadoReserva,
} from "@/lib/beta-android";
import { cn } from "@/lib/utils";

/**
 * Onde a pessoa está (28/10/2026): no iPhone só faz sentido o beta do iPhone, no Android só o do
 * Android, no computador os dois, e dentro do próprio app nenhum ("baixe o app" não faz sentido lá).
 */
export type PlataformaVisitante = "ios" | "android" | "desktop" | "app";
export function usePlataformaVisitante(): PlataformaVisitante {
  const [p, setP] = useState<PlataformaVisitante>("desktop");
  useEffect(() => {
    try {
      const w = window as unknown as { __controlAllApp?: unknown };
      if (w.__controlAllApp || document.documentElement.classList.contains("native-app")) return setP("app");
      const ua = navigator.userAgent;
      if (/android/i.test(ua)) return setP("android");
      if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return setP("ios");
    } catch {
      // sem navegador (servidor): fica "desktop"
    }
  }, []);
  return p;
}

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

/** Robô verde do Android (desenho simples, sem marca). */
export function IconeAndroid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden="true" fill="currentColor">
      <path d="M6 9h12v8a1 1 0 0 1-1 1h-1v3h-2v-3h-4v3H8v-3H7a1 1 0 0 1-1-1V9Zm-3 0h2v6H3V9Zm16 0h2v6h-2V9ZM7.5 3.2l1 1.6A6 6 0 0 1 12 4a6 6 0 0 1 3.5.8l1-1.6.8.5-1 1.6A5.5 5.5 0 0 1 18 8H6a5.5 5.5 0 0 1 1.7-2.7l-1-1.6.8-.5ZM9.5 6a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Zm5 0a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Z" />
    </svg>
  );
}

/** Passo a passo do beta no Android (Google Play), com reserva de vaga (limite de 50). */
export function InstrucoesAndroid({ aberto, onOpenChange }: { aberto: boolean; onOpenChange: (v: boolean) => void }) {
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const { data: config } = useQuery({ queryKey: ["configuracao-acesso-publica"], queryFn: () => obterConfig(), staleTime: 60_000, enabled: aberto });
  const BETA_ANDROID_ABERTO = Boolean(config?.beta_android_aberto);
  const { data: usadas, refetch } = useQuery({ queryKey: ["vagas-beta-android"], queryFn: vagasUsadasAndroid, enabled: aberto, staleTime: 60_000 });
  const [reserva, setReserva] = useState<ResultadoReserva | null>(null);
  const [reservando, setReservando] = useState(false);
  const restantes = usadas == null ? null : Math.max(0, LIMITE_BETA_ANDROID - usadas);
  const liberado = reserva === "reservada" || reserva === "ja_reservada";

  async function reservar() {
    setReservando(true);
    const r = await reservarVagaAndroid();
    setReserva(r);
    setReservando(false);
    registrarEventoUso(`aviso-beta/android-${r}`);
    void refetch();
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Control All Beta no Android</DialogTitle>
          <DialogDescription>Teste o app no celular Android pela Google Play.</DialogDescription>
        </DialogHeader>
        {!BETA_ANDROID_ABERTO ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm">
            O teste no Android está em análise no Google. Assim que for liberado, as vagas abrem aqui.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {restantes == null ? `Limite de ${LIMITE_BETA_ANDROID} testadores.` : restantes > 0 ? `${restantes} de ${LIMITE_BETA_ANDROID} vagas disponíveis.` : "Vagas esgotadas."}
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Reserve a sua vaga (uma por conta do Control ALL).</li>
              <li>
                Entre no grupo de testadores com a <strong>mesma conta Google</strong> do seu celular Android (toque em "Participar do grupo").
              </li>
              <li>Abra o link do teste, toque em <strong>Tornar-se testador</strong> e depois em <strong>baixar na Google Play</strong>.</li>
              <li>Fique no teste por pelo menos 14 dias: é o que libera o app para todos.</li>
            </ol>
            {reserva === "lotado" && <p className="text-sm font-medium text-red-600">As 50 vagas acabaram. Avisaremos quando abrir para todos.</p>}
            {(reserva === "erro" || reserva === "sem_login") && <p className="text-sm text-red-600">Não consegui reservar agora. Entre na sua conta e tente de novo.</p>}
            {!liberado ? (
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={reservando || restantes === 0} onClick={() => void reservar()}>
                {reservando ? <Loader2 className="size-4 animate-spin" /> : null} Reservar minha vaga
              </Button>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline">
                  <a href={LINK_GRUPO_ANDROID} target="_blank" rel="noreferrer" onClick={() => registrarEventoUso("aviso-beta/android-grupo")}>
                    1. Entrar no grupo <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
                  <a href={LINK_TESTE_ANDROID} target="_blank" rel="noreferrer" onClick={() => registrarEventoUso("aviso-beta/android-teste")}>
                    2. Aceitar o teste <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Faixa de destaque de um beta (28/10/2026): mesmo desenho para Android e iPhone. */
function FaixaBeta({
  className,
  fundo,
  icone,
  selo,
  titulo,
  texto,
  rotuloBotao,
  iconeBotao,
  corBotao,
  href,
  onAbrir,
  esgotado,
  evento,
  onFechar,
}: {
  className?: string | undefined;
  fundo: string;
  icone: React.ReactNode;
  selo: string;
  titulo: string;
  texto: string;
  rotuloBotao: string;
  iconeBotao: React.ReactNode;
  corBotao: string;
  href: string;
  onAbrir?: (() => void) | undefined;
  esgotado?: boolean | undefined;
  evento: string;
  onFechar?: (() => void) | undefined;
}) {
  const classeBotao = cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-white/90 disabled:opacity-60",
    corBotao,
  );
  const conteudoBotao = (
    <>
      {iconeBotao} {esgotado ? "Vagas esgotadas" : rotuloBotao}
    </>
  );
  return (
    <section className={cn("native:hidden relative flex-1 overflow-hidden rounded-2xl p-4 text-white shadow-lg", fundo, className)}>
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
      {onFechar && (
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar aviso"
          className="absolute right-2 top-2 z-10 rounded-md p-1 text-white/80 hover:bg-white/15 hover:text-white"
        >
          <X className="size-4" />
        </button>
      )}
      <div className="relative flex h-full flex-col gap-3 sm:flex-row sm:items-center">
        <span className="relative flex size-14 shrink-0 items-center justify-center self-start rounded-2xl bg-white shadow-md ring-2 ring-white/60 sm:self-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-white/40 [animation-duration:2.5s]" />
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">{selo}</p>
          <p className="text-base font-semibold leading-snug">{titulo}</p>
          <p className="text-sm text-white/85">{texto}</p>
        </div>
        {onAbrir ? (
          <button
            type="button"
            className={classeBotao}
            disabled={esgotado}
            onClick={() => {
              registrarEventoUso(evento);
              onAbrir();
            }}
          >
            {conteudoBotao}
          </button>
        ) : esgotado ? (
          <span className={classeBotao}>{conteudoBotao}</span>
        ) : (
          <a href={href} className={classeBotao} onClick={() => registrarEventoUso(evento)}>
            {conteudoBotao}
          </a>
        )}
      </div>
    </section>
  );
}

/**
 * Destaque do beta Android (28/10/2026): faixa verde no topo da página inicial pública e do Início,
 * só quando o admin abre as vagas (configuracoes_acesso_site.beta_android_aberto).
 * Na página pública leva para /inicio?beta=android (o login devolve para lá); no Início abre o passo a passo.
 */
export function DestaqueAndroid({ className, onAbrir, onFechar }: { className?: string; onAbrir?: () => void; onFechar?: () => void }) {
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const { data: config } = useQuery({ queryKey: ["configuracao-acesso-publica"], queryFn: () => obterConfig(), staleTime: 60_000 });
  const aberto = Boolean(config?.beta_android_aberto);
  const { data: usadas } = useQuery({ queryKey: ["vagas-beta-android"], queryFn: vagasUsadasAndroid, enabled: aberto, staleTime: 60_000 });
  if (!aberto) return null;
  const restantes = usadas == null ? null : Math.max(0, LIMITE_BETA_ANDROID - usadas);
  const vagas = restantes == null ? `${LIMITE_BETA_ANDROID} vagas` : restantes > 0 ? `${restantes} de ${LIMITE_BETA_ANDROID} vagas livres` : "Vagas esgotadas";
  return (
    <FaixaBeta
      className={className}
      fundo="bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500 shadow-emerald-500/20"
      icone={<IconeAndroid className="relative size-9 text-[#3DDC84]" />}
      selo="Novo · Beta aberto no Android"
      titulo="O app Control ALL para Android está disponível para testar"
      texto={`Instale pela Google Play e ajude a lançar o app para todos. ${vagas}.`}
      rotuloBotao="Quero testar no Android"
      iconeBotao={<IconeAndroid className="size-5" />}
      corBotao="text-emerald-700"
      href="/inicio?beta=android"
      onAbrir={onAbrir}
      esgotado={restantes === 0}
      evento={onAbrir ? "aviso-beta/android-destaque-inicio" : "aviso-beta/android-home"}
      onFechar={onFechar}
    />
  );
}

/** Destaque do beta do iPhone, iPad e Mac (TestFlight), no mesmo desenho da faixa do Android. */
export function DestaqueIos({ className, onAbrir, onFechar }: { className?: string; onAbrir?: () => void; onFechar?: () => void }) {
  const { data } = useQuery({ queryKey: ["vagas-beta-testflight"], queryFn: () => vagasDoBeta(), staleTime: 10 * 60 * 1000 });
  const limite = data?.limite ?? 50;
  const lotado = data?.estado === "lotado";
  return (
    <FaixaBeta
      className={className}
      fundo="bg-gradient-to-r from-zinc-900 via-slate-800 to-sky-800 shadow-sky-900/20"
      icone={<Apple className="relative size-8 text-zinc-900" />}
      selo="Novo · Beta aberto no iPhone, iPad e Mac"
      titulo="O app Control ALL para iPhone está disponível para testar"
      texto={`Instale pelo TestFlight da Apple e ajude a lançar o app na App Store. Limite de ${limite} testadores.`}
      rotuloBotao="Quero testar no iPhone"
      iconeBotao={<Apple className="size-5" />}
      corBotao="text-zinc-900"
      href="/inicio?beta=ios"
      onAbrir={onAbrir}
      esgotado={lotado}
      evento={onAbrir ? "aviso-beta/ios-destaque-inicio" : "aviso-beta/ios-home"}
      onFechar={onFechar}
    />
  );
}

/**
 * As faixas do beta (28/10/2026): mostra só a da plataforma de quem está vendo (as duas no computador)
 * e nenhuma dentro do app. Com `dispensavel`, o X esconde as faixas para esta conta até o admin disparar
 * uma rodada nova do aviso do beta.
 */
export function DestaquesBeta({
  className,
  onIos,
  onAndroid,
  dispensavel = false,
}: {
  className?: string;
  onIos?: () => void;
  onAndroid?: () => void;
  dispensavel?: boolean;
}) {
  const plataforma = usePlataformaVisitante();
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const { data: config } = useQuery({ queryKey: ["configuracao-acesso-publica"], queryFn: () => obterConfig(), staleTime: 60_000 });
  const rodada = Math.max(1, Number(config?.rodada_aviso_beta ?? 0));
  const aviso = useAvisoDispensado("beta");
  if (plataforma === "app") return null;
  if (dispensavel && (aviso.carregando || aviso.rodadaDispensada >= rodada)) return null;
  const fechar = dispensavel
    ? () => {
        registrarEventoUso("aviso-beta/faixa-fechada");
        void aviso.dispensar(rodada);
      }
    : undefined;
  return (
    <div className={cn("native:hidden flex flex-col gap-3 lg:flex-row empty:hidden", className)}>
      {plataforma !== "ios" && <DestaqueAndroid {...(onAndroid ? { onAbrir: onAndroid } : {})} onFechar={fechar} />}
      {plataforma !== "android" && <DestaqueIos {...(onIos ? { onAbrir: onIos } : {})} onFechar={fechar} />}
    </div>
  );
}

/** Card do beta (o formato que aparece para o usuário). */
export function CardBeta({
  className,
  onQueroTestar,
  onAndroid,
  rodape,
  onFechar,
}: {
  className?: string;
  onQueroTestar: () => void;
  /** Botão do Android (abre o passo a passo do Google Play). */
  onAndroid?: () => void;
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
          <p className="text-xs text-muted-foreground">
            Teste o app no iPhone, iPad e Mac pelo TestFlight{onAndroid ? " ou no Android pela Google Play" : ""}. Limite de {limite} testadores{onAndroid ? " em cada" : ""}.
          </p>
          <span className={cn("mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", cor)}>{rotulo}</span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={onQueroTestar}>
            <Apple className="size-4" /> {onAndroid ? "iPhone" : "Quero testar"}
          </Button>
          {onAndroid && (
            <Button variant="outline" className="border-emerald-600/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400" onClick={onAndroid}>
              <IconeAndroid /> Android
            </Button>
          )}
        </div>
      </div>
      {rodape}
    </section>
  );
}

/** Card fixo do beta na Início do site. No app não aparece (lá o próprio app já é o beta). */
export function BetaTestFlight({ className }: { className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [android, setAndroid] = useState(false);
  // Link da página inicial pública ("Beta no Google Play") traz ?beta=android: abre o passo a passo direto.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("beta") === "android") setAndroid(true);
      else if (p.get("beta") === "ios") setAberto(true);
    } catch {
      // sem URL (render no servidor)
    }
  }, []);
  return (
    <>
      {/* 28/10/2026: só as faixas (o card de baixo repetia a mesma coisa). */}
      <DestaquesBeta className={cn("mb-4", className)} dispensavel onAndroid={() => setAndroid(true)} onIos={() => setAberto(true)} />
      <InstrucoesBeta aberto={aberto} onOpenChange={setAberto} />
      <InstrucoesAndroid aberto={android} onOpenChange={setAndroid} />
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
  const plataforma = usePlataformaVisitante();
  const [visivel, setVisivel] = useState(false);
  const [instrucoes, setInstrucoes] = useState(false);
  const [android, setAndroid] = useState(false);
  const rodada = Number(config?.rodada_aviso_beta ?? 0);

  // 28/10/2026: antes aparecia em toda sessão até marcar "não mostrar". Agora aparece UMA vez por
  // rodada (por conta, em qualquer aparelho), nunca dentro do app, e só com o beta da plataforma.
  useEffect(() => {
    if (bloqueado || carregando || !config || rodada <= 0 || rodadaDispensada >= rodada) return;
    if (plataforma === "app") return;
    void dispensar(rodada);
    setVisivel(true);
    registrarEventoUso("aviso-beta/exibido");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloqueado, carregando, config, rodada, rodadaDispensada, plataforma]);

  useEffect(() => onVisibilityChange?.(visivel), [visivel, onVisibilityChange]);

  return (
    <>
      {visivel && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-3xl animate-in fade-in slide-in-from-top-4">
          <div className="relative rounded-2xl bg-background/95 p-2 shadow-xl backdrop-blur">
            <button
              type="button"
              onClick={() => {
                registrarEventoUso("aviso-beta/fechou");
                setVisivel(false);
              }}
              aria-label="Fechar aviso"
              className="absolute -right-2 -top-2 z-20 rounded-full border bg-background p-1 text-muted-foreground shadow hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <DestaquesBeta
              onIos={() => {
                registrarEventoUso("aviso-beta/quero-testar");
                setVisivel(false);
                setInstrucoes(true);
              }}
              onAndroid={() => {
                registrarEventoUso("aviso-beta/quero-testar-android");
                setVisivel(false);
                setAndroid(true);
              }}
            />
          </div>
        </div>
      )}
      <InstrucoesBeta aberto={instrucoes} onOpenChange={setInstrucoes} />
      <InstrucoesAndroid aberto={android} onOpenChange={setAndroid} />
    </>
  );
}
