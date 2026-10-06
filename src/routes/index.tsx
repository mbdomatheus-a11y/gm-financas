import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Calculator,
  CalendarClock,
  Car,
  Check,
  FileHeart,
  FileUp,
  MapPin,
  Mic,
  PawPrint,
  Percent,
  PlayCircle,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BrandAnimado } from "@/components/ferramentas/BrandAnimado";
import { BrandMark } from "@/components/BrandMark";
import { EducacaoFinanceira } from "@/components/EducacaoFinanceira";
import { IlustracaoCalendario, IlustracaoFamilia, IlustracaoNotas } from "@/components/Ilustracoes";
import { LegalDialogs } from "@/components/LegalDialogs";
import { SiteHeader } from "@/components/SiteHeader";
import { obterEstatisticaPublica } from "@/lib/estatisticas-site.functions";
import { obterParceriaHome, registrarCliqueParceria } from "@/lib/parceria.functions";
import { listarModulosPublicos } from "@/lib/modulos-publicos.functions";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control ALL | Finanças, notas fiscais e um assistente para o seu dia a dia" },
      {
        name: "description",
        content:
          "Organize receitas, despesas, parcelas e notas fiscais em um só lugar, com um assistente de IA para lançar e resumir seus gastos. Gratuito.",
      },
      {
        property: "og:title",
        content: "Control ALL | Seu dinheiro e suas notas fiscais organizados",
      },
      {
        property: "og:description",
        content:
          "Finanças pessoais, notas fiscais com garantia, lista de compras, calendário e calculadoras gratuitas.",
      },
      { property: "og:url", content: "https://www.controlall.com.br/" },
    ],
    links: [{ rel: "canonical", href: "https://www.controlall.com.br/" }],
  }),
  component: LandingPage,
});

const modulos = [
  {
    icon: Wallet,
    titulo: "Finanças",
    texto: "Receitas, despesas fixas e variáveis, cartões, investimentos e faturas em um só painel.",
    detalhes: [
      "Acompanhe cada parcela e veja quando ela termina.",
      "Importe faturas e confira tudo antes de lançar.",
      "Gráficos por mês e calendário de vencimentos.",
    ],
  },
  {
    icon: ReceiptText,
    titulo: "Notas fiscais e garantias",
    texto: "Guarde suas notas e saiba quando cada garantia termina.",
    detalhes: [
      "Leia o QR Code da nota ou digite a chave de acesso.",
      "Quando o portal da SEFAZ permite, os itens vêm preenchidos.",
      "Alerta de garantia perto do vencimento.",
    ],
  },
  {
    icon: ShoppingCart,
    titulo: "Lista de compras",
    texto: "Lista compartilhada com a família, com aprovação de itens.",
    detalhes: [
      "Estime o custo de cada compra em horas de trabalho.",
      "Itens aprovados aparecem no calendário.",
      "Peça para a IA adicionar itens por texto ou voz.",
    ],
  },
  {
    icon: Car,
    titulo: "Veículo",
    texto: "Manutenções, documentos, garantias e alertas do carro ou da moto.",
    detalhes: ["Registro de eventos e custos.", "Alertas de revisão e vencimentos."],
  },
  {
    icon: PawPrint,
    titulo: "Pet",
    texto: "Vacinas e cuidados dos animais da casa.",
    detalhes: ["Histórico de vacinas.", "Lembretes de cuidados."],
  },
  {
    icon: MapPin,
    titulo: "Onde está?",
    texto: "Anote onde guardou documentos e objetos e encontre rápido.",
    detalhes: ["Busca simples.", "Organização por local."],
  },
  {
    icon: FileHeart,
    titulo: "Exames",
    texto: "Histórico privado de exames de saúde.",
    detalhes: ["Visível só para você.", "Importação com conferência antes de salvar."],
  },
  {
    icon: Calculator,
    titulo: "Calculadoras gratuitas",
    texto: "Ferramentas de uso geral, sem precisar de cadastro.",
    detalhes: [
      "Diferença entre datas e soma de dias a uma data.",
      "Soma de horários.",
      "Simulador didático de dose e diluição.",
    ],
  },
];

const CHAVE_MODULO: Record<string, string> = {
  "Finanças": "financas",
  "Notas fiscais e garantias": "notas",
  "Lista de compras": "lista",
  "Veículo": "veiculo",
  "Pet": "pet",
  "Onde está?": "onde_esta",
  "Exames": "exames",
  "Calculadoras gratuitas": "calculadora",
};

function useModulosLiberados() {
  const listarFn = useServerFn(listarModulosPublicos);
  const { data } = useQuery({
    queryKey: ["modulos-publicos-home"],
    staleTime: 60_000,
    queryFn: () => listarFn(),
  });
  return (titulo: string) => {
    const chave = CHAVE_MODULO[titulo];
    const m = data?.find((x) => x.modulo === chave);
    return m ? m.habilitado : true;
  };
}

const recursos = [
  {
    icon: Sparkles,
    titulo: "Assistente de IA",
    texto:
      "Digite ou fale um gasto e a IA monta o lançamento para você conferir. Também resume o seu mês e responde perguntas sobre suas finanças.",
  },
  {
    icon: FileUp,
    titulo: "Importe e confira",
    texto: "Faturas e exames entram como prévia: você corrige e aprova antes de salvar.",
  },
  {
    icon: BellRing,
    titulo: "Não deixe passar",
    texto: "Alertas de contas, garantias, manutenção e lembretes, tudo no calendário.",
  },
  {
    icon: CalendarClock,
    titulo: "Alívio de parcelas",
    texto: "Veja em que mês cada parcelamento termina e quanto sobra no orçamento.",
  },
  {
    icon: ShieldCheck,
    titulo: "Privacidade",
    texto: "Seus dados ficam na sua conta e só são compartilhados se você escolher.",
  },
  {
    icon: Mic,
    titulo: "Texto ou voz",
    texto: "Prefere falar? Grave um áudio curto para lançar um gasto ou pedir um resumo.",
  },
];

function useParceriaHome() {
  const obterFn = useServerFn(obterParceriaHome);
  return useQuery({
    queryKey: ["parceria-home-publica"],
    staleTime: 60_000,
    queryFn: () => obterFn(),
  });
}

/** Anúncio da parceria, separado do conteúdo: abre como janela (uma vez por visita). */
function ParceriaBloco() {
  const { data: parceria } = useParceriaHome();
  const registrarCliqueFn = useServerFn(registrarCliqueParceria);
  if (!parceria) return null;
  const previewUrl = parceria.previewImagemPath
    ? supabase.storage.from("site_assets").getPublicUrl(parceria.previewImagemPath).data.publicUrl
    : null;
  const linhas = parceria.slogan ? parceria.slogan.split("\n").filter(Boolean) : [];
  return (
    <section aria-label="Parceria patrocinada" className="mx-auto max-w-3xl px-4 py-8">
      <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Patrocinado
      </p>
      <a
        href={parceria.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => {
          registrarCliqueFn().catch(() => {});
        }}
        className="lift group flex items-center gap-4 rounded-2xl border bg-card p-3 shadow-sm"
      >
        {previewUrl && (
          <img src={previewUrl} alt="" className="h-20 w-28 shrink-0 rounded-xl border object-cover" />
        )}
        <div className="min-w-0 flex-1">
          {linhas[0] && (
            <p className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
              <Percent className="size-4 shrink-0" />
              <span>{linhas[0]}</span>
            </p>
          )}
          {linhas[1] && <p className="mt-0.5 text-xs text-muted-foreground">{linhas[1]}</p>}
        </div>
        <ArrowRight className="size-5 shrink-0 text-amber-600 transition-transform group-hover:translate-x-1" />
      </a>
    </section>
  );
}

function ParceriaPopup() {
  const { data: parceria } = useParceriaHome();
  const registrarCliqueFn = useServerFn(registrarCliqueParceria);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!parceria) return;
    try {
      if (sessionStorage.getItem("control-all-parceria-vista")) return;
    } catch {
      // sem armazenamento: mostra mesmo assim
    }
    const t = setTimeout(() => setAberto(true), 2500);
    return () => clearTimeout(t);
  }, [parceria]);

  if (!parceria) return null;
  const previewUrl = parceria.previewImagemPath
    ? supabase.storage.from("site_assets").getPublicUrl(parceria.previewImagemPath).data.publicUrl
    : null;
  const linhas = parceria.slogan ? parceria.slogan.split("\n").filter(Boolean) : [];

  function fechar(v: boolean) {
    setAberto(v);
    if (!v) {
      try {
        sessionStorage.setItem("control-all-parceria-vista", "1");
      } catch {
        // ignorado
      }
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <p className="px-4 pt-4 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Patrocinado
        </p>
        <DialogTitle className="sr-only">Parceria patrocinada</DialogTitle>
        <DialogDescription className="sr-only">Anúncio de um parceiro do Control ALL</DialogDescription>
        <a
          href={parceria.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => {
            registrarCliqueFn().catch(() => {});
          }}
          className="group flex flex-col gap-3 p-4 pt-2"
        >
          {previewUrl && (
            <img src={previewUrl} alt="" className="h-44 w-full rounded-xl border object-cover" />
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {linhas[0] && (
                <p className="flex items-center gap-1.5 text-base font-bold text-amber-700 dark:text-amber-400">
                  <Percent className="size-4 shrink-0" />
                  <span>{linhas[0]}</span>
                </p>
              )}
              {linhas[1] && <p className="mt-0.5 text-sm text-muted-foreground">{linhas[1]}</p>}
            </div>
            <ArrowRight className="size-5 shrink-0 text-amber-600 transition-transform group-hover:translate-x-1" />
          </div>
        </a>
      </DialogContent>
    </Dialog>
  );
}

function useVideoDemonstracaoUrl() {
  const { data: path } = useQuery({
    queryKey: ["identidade-visual-site-video"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("identidade_visual_site")
        .select("video_demonstracao_path")
        .eq("id", true)
        .maybeSingle();
      return (data?.video_demonstracao_path as string | null | undefined) ?? null;
    },
  });
  return path ? supabase.storage.from("site_videos").getPublicUrl(path).data.publicUrl : null;
}

function EconomiaTotalBanner() {
  const obterFn = useServerFn(obterEstatisticaPublica);
  const { data } = useQuery({
    queryKey: ["estatistica-publica-economia-home"],
    queryFn: () => obterFn(),
  });
  const valor = data?.economiaTotalExibida;
  if (valor === null || valor === undefined) return null;
  return (
    <section className="border-b bg-emerald-500/10">
      <div className="mx-auto max-w-6xl px-4 py-3 text-center text-sm">
        <span className="font-semibold text-emerald-700">{formatBRL(valor)}</span>{" "}
        <span className="text-muted-foreground">
          já economizados por quem usa o Control ALL para ajustar gastos e parcelas.
        </span>
      </div>
    </section>
  );
}

const jsonLdSoftwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Control ALL",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: "https://www.controlall.com.br/",
  description:
    "Controle de receitas, despesas, parcelamentos e notas fiscais, com assistente de IA para lançar e resumir gastos.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
  },
  featureList: [
    "Controle de receitas e despesas",
    "Importação e conferência de faturas de cartão",
    "Notas fiscais com prazo de garantia",
    "Controle de parcelamentos",
    "Calendário financeiro",
    "Calculadoras gratuitas",
  ],
};

function LandingPage() {
  const moduloLiberado = useModulosLiberados();
  const navigate = useNavigate();
  const videoUrl = useVideoDemonstracaoUrl();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio" });
    });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftwareApplication) }}
      />
      <SiteHeader home />
      <EconomiaTotalBanner />
      <ParceriaPopup />

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-40 size-80 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.1fr_.9fr] md:py-24">
          <div className="flex flex-col justify-center">
            <BrandAnimado className="mb-5" />

            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-3.5" />
              Finanças, notas fiscais e IA para te ajudar no dia a dia
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Seu dinheiro e suas notas fiscais, finalmente{" "}
              <span className="text-gradient-brand">sob controle.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Organize receitas, despesas e parcelas, guarde suas notas fiscais e garantias e use um
              assistente de IA para lançar gastos por texto ou voz e resumir o seu mês. Tudo em um só
              lugar, simples para toda a família e gratuito.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-sm font-semibold">
                <Link to="/entrar" search={{ criar: true }}>
                  Criar minha conta grátis <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-5 text-sm">
                <a href="#demonstracao">
                  <PlayCircle className="mr-2 size-4 text-primary" /> Ver demonstração
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 px-5 text-sm">
                <Link to="/calculadoras">
                  <Calculator className="mr-2 size-4 text-primary" /> Calculadoras
                </Link>
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" /> Gratuito
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" /> Cadastro rápido
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" /> Dados só seus
              </span>
            </div>
          </div>

          {/* Exemplo ilustrativo */}
          <Card className="rounded-3xl border-primary/20 bg-card/80 shadow-[var(--shadow-soft)] backdrop-blur-md">
            <CardContent className="flex h-full flex-col space-y-4 p-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Exemplo ilustrativo
                  </span>
                  <p className="text-base font-bold">Resumo do mês</p>
                </div>
                <BrandMark className="size-10 opacity-90" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
                  <p className="text-xs text-muted-foreground">Receitas</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">R$ 8.240,00</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-3.5">
                  <p className="text-xs text-muted-foreground">Despesas e parcelas</p>
                  <p className="text-lg font-bold">R$ 5.190,00</p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-xs">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <Sparkles className="size-4" /> Lançar com IA
                </div>
                <p className="text-muted-foreground">
                  Você escreve ou fala: <em>"mercado, 85 reais no cartão"</em>. O assistente monta o
                  lançamento e você confere antes de salvar.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs">
                <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-300">
                  <CalendarClock className="size-4 shrink-0" />
                  <span>Última parcela de uma compra termina este mês</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                  <ReceiptText className="size-4 shrink-0" />
                  <span>Garantia de uma nota fiscal termina em 30 dias</span>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Seus módulos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {modulos
                    .filter((m) => m.titulo !== "Calculadoras gratuitas")
                    .map(({ icon: Icon, titulo }) => {
                      const ok = moduloLiberado(titulo);
                      return (
                        <div
                          key={titulo}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs",
                            ok ? "bg-background" : "bg-muted/40 opacity-60",
                          )}
                        >
                          <Icon className={cn("size-4 shrink-0", ok ? "text-primary" : "text-muted-foreground")} />
                          <span className="min-w-0 flex-1 truncate font-medium">{titulo}</span>
                          {!ok && (
                            <span className="shrink-0 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300">
                              Em breve
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <ParceriaBloco />

      {/* Recursos */}
      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow">Recursos</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Organização que acompanha a vida real.</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recursos.map(({ icon: Icon, titulo, texto }) => (
            <Card key={titulo} className="lift">
              <CardContent className="p-6">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-bold">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="scroll-mt-20 border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow">Módulos</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Use só o que fizer sentido para a sua casa.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Cada módulo é independente. Comece pelas finanças e ative os outros quando precisar.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {modulos.map(({ icon: Icon, titulo, texto, detalhes }) => {
              const liberado = moduloLiberado(titulo);
              return (
              <Card key={titulo} className={cn("flex flex-col", liberado ? "lift" : "relative opacity-60 grayscale")}>
                <CardContent className="flex flex-1 flex-col p-5">
                  {!liberado && (
                    <span className="mb-2 inline-flex w-fit items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Em breve
                    </span>
                  )}
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-base font-bold">{titulo}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{texto}</p>
                  <ul className="mt-4 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                    {detalhes.map((d) => (
                      <li key={d} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                  {!liberado && (
                    <p className="mt-3 text-[11px] italic text-muted-foreground">Lançamento em breve</p>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>

          <div className="mt-10 grid items-center gap-8 md:grid-cols-2">
            <IlustracaoNotas className="mx-auto w-full max-w-sm" />
            <div>
              <h3 className="text-xl font-bold">Notas e garantias, sem papel perdido.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Cadastre a nota, informe o prazo e deixe o Control ALL avisar quando a garantia estiver
                perto do fim. Tudo aparece também no calendário.
              </p>
            </div>
          </div>
          <div className="mt-10 grid items-center gap-8 md:grid-cols-2">
            <div className="order-2 md:order-1">
              <h3 className="text-xl font-bold">Calendário que mostra o que vem por aí.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Faturas com o total, notas lançadas, fim de garantia e itens aprovados da lista de
                compras, mês a mês.
              </p>
            </div>
            <IlustracaoCalendario className="order-1 mx-auto w-full max-w-sm md:order-2" />
          </div>
        </div>
      </section>

      {/* Demonstração */}
      <section id="demonstracao" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="eyebrow">Demonstração</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Veja antes de decidir.</h2>
            <p className="mt-4 text-muted-foreground">
              Uma apresentação rápida com dados fictícios, sem expor informações de ninguém.
            </p>
            {!videoUrl && (
              <Button className="mt-6" variant="outline" disabled>
                <PlayCircle className="size-4" /> Vídeo de apresentação em breve
              </Button>
            )}
          </div>
          {videoUrl ? (
            <Card className="overflow-hidden p-0">
              <video src={videoUrl} controls preload="metadata" className="aspect-video w-full bg-black" />
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
                <PlayCircle className="size-11 text-primary" />
                <b className="mt-3">Demonstração do Control ALL</b>
                <p className="mt-1 text-sm text-muted-foreground">O vídeo será exibido aqui.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Educação financeira */}
      <section id="educacao-financeira" className="scroll-mt-20 border-t bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <div className="mb-8 grid items-center gap-8 md:grid-cols-2">
            <IlustracaoFamilia className="mx-auto w-full max-w-md" />
            <div>
              <p className="eyebrow">Para toda a família</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Educação financeira para todas as idades.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Crianças, jovens, adultos e idosos podem aprender e usar juntos. Veja dicas práticas
                para cada fase da vida.
              </p>
            </div>
          </div>
          <EducacaoFinanceira />
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="scroll-mt-20 border-t bg-primary/5">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <p className="eyebrow justify-center">Preços</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Gratuito para usar.
          </h2>
          <Card className="mx-auto mt-8 max-w-sm border-primary shadow-xl">
            <CardContent className="p-8">
              <p className="text-sm font-bold uppercase tracking-wider text-primary">Control ALL</p>
              <p className="mt-3 text-4xl font-extrabold">
                {formatBRL(0)}
                <span className="text-base font-normal text-muted-foreground"> / mês</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Sem cobrança para usar o site.</p>
              <ul className="mt-6 space-y-2.5 border-y py-4 text-left text-xs text-muted-foreground">
                {[
                  "Finanças, notas fiscais e lista de compras",
                  "Calendário de faturas, garantias e compras",
                  "Assistente de IA para lançar e resumir gastos",
                  "Calculadoras e links temporários",
                  "Seus dados ficam na sua conta",
                ].map((i) => (
                  <li className="flex items-center gap-2" key={i}>
                    <Check className="size-4 shrink-0 text-emerald-600" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-6 w-full font-semibold">
                <Link to="/entrar" search={{ criar: true }}>
                  Criar conta grátis
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t px-6 py-8 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Control ALL LTDA. Todos os direitos reservados.</p>
        <div className="flex items-center gap-4">
          <Link to="/calculadoras" className="hover:underline">
            Calculadoras
          </Link>
          <Link to="/links-temporarios" className="hover:underline">
            Link temporário
          </Link>
          <LegalDialogs compact />
        </div>
      </footer>
    </main>
  );
}
