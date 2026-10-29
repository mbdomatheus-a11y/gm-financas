import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Smartphone } from "lucide-react";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { LINK_TESTFLIGHT } from "@/lib/testflight.functions";
import { IconeAndroid, MacaBeta, usePlataformaVisitante } from "@/components/BetaTestFlight";
import { cn } from "@/lib/utils";

function Loja({ icone, pequeno, nome, href, mesmaAba }: { icone: React.ReactNode; pequeno: string; nome: string; href?: string; mesmaAba?: boolean }) {
  const Tag: any = href ? "a" : "div";
  return (
    <Tag
      {...(href ? (mesmaAba ? { href } : { href, target: "_blank", rel: "noreferrer" }) : {})}
      className={cn("flex items-center gap-2.5 rounded-xl border border-border bg-foreground px-4 py-2 text-background", href ? "transition-opacity hover:opacity-80" : "opacity-90")}
      aria-label={href ? `${nome}: abrir convite do beta` : `${nome}: em breve`}
    >
      {icone}
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wide opacity-80">{pequeno}</span>
        <span className="block text-sm font-semibold">{nome}</span>
      </span>
    </Tag>
  );
}

/** Aviso de que o aplicativo do Control ALL para celular está a caminho. */
export function AppEmBreve({ className }: { className?: string }) {
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const { data: config } = useQuery({ queryKey: ["configuracao-acesso-publica"], queryFn: () => obterConfig(), staleTime: 60_000 });
  const android = Boolean(config?.beta_android_aberto);
  // 28/10/2026: no iPhone só o TestFlight, no Android só a Google Play, dentro do app nada.
  const plataforma = usePlataformaVisitante();
  if (plataforma === "app") return null;
  const verIos = plataforma !== "android";
  const verAndroid = plataforma !== "ios";
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
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          {plataforma === "android" ? (android ? "Beta aberto no Android" : "Android em breve") : plataforma === "ios" ? "Beta aberto no iPhone e iPad" : android ? "Beta aberto no iPhone, iPad, Mac e Android" : "Beta aberto no iPhone, iPad e Mac"}
        </p>
        <h2 className="text-lg font-semibold">Um novo app para você</h2>
        <p className="text-sm text-muted-foreground">
          {plataforma === "android"
            ? android
              ? "O app do Control ALL já está em teste pela Google Play (50 vagas)."
              : "O app do Control ALL para Android está quase pronto."
            : plataforma === "ios"
              ? "O app do Control ALL já está em teste pelo TestFlight (50 vagas)."
              : android
                ? "O app do Control ALL já está em teste pelo TestFlight e pela Google Play (50 vagas em cada)."
                : "O app do Control ALL já está em teste pelo TestFlight. Android em breve."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {verIos && <Loja icone={<MacaBeta className="size-8" />} pequeno="Beta no" nome="TestFlight" href={LINK_TESTFLIGHT} />}
        {!verAndroid ? null : android ? (
          <Loja icone={<IconeAndroid className="size-7 text-[#3DDC84]" />} pequeno="Beta no" nome="Google Play" href="/inicio?beta=android" mesmaAba />
        ) : (
          <Loja icone={<Play className="size-5" />} pequeno="Em breve no" nome="Google Play" />
        )}
      </div>
    </section>
  );
}
