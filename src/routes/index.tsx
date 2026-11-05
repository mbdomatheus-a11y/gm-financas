import { AppEmBreve } from "@/components/AppEmBreve";
import { CarrosselModulos } from "@/components/landing/CarrosselModulos";
import { VitrineDispositivos } from "@/components/landing/VitrineDispositivos";
import { DestaquesBeta } from "@/components/BetaTestFlight";
import { BannerOfertaHome } from "@/components/BannerOfertaHome";
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
import { ehAppNativo } from "@/lib/app-nativo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BrandAnimado } from "@/components/ferramentas/BrandAnimado";
import { BrandMark } from "@/components/BrandMark";
import { EducacaoFinanceira } from "@/components/EducacaoFinanceira";
import { IlustracaoCalendario, IlustracaoFamilia, IlustracaoNotas } from "@/components/Ilustracoes";
import { ComoFunciona, FaqBloco, PerdasInvisiveis, SegurancaBloco } from "@/components/home/BlocosHome";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { obterEstatisticaPublica } from "@/lib/estatisticas-site.functions";
import { obterParceriaHome, registrarCliqueParceria } from "@/lib/parceria.functions";
import { listarModulosPublicos } from "@/lib/modulos-publicos.functions";
import { formatBRL } from "@/lib/format";
import { contadorUsuariosPublico } from "@/lib/funil.functions";
import { rastrearEvento } from "@/lib/funil-cliente";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control ALL | App de controle financeiro e notas fiscais" },
      {
        name: "description",
        content:
          "Control ALL é um app gratuito de controle financeiro: organize receitas, despesas, faturas de cartão, parcelas e notas fiscais em um só lugar, com assistente de IA.",
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

/** Anúncio da parceria: bloco fixo e discreto, sem janela por cima do conteúdo. */
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
      <p className="mb-1.5 text-center text-xs font-medium text-muted-foreground">
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
    <p className="text-sm text-muted-foreground sm:text-base">
      <b className="font-semibold text-foreground">{formatBRL(valor)}</b> já economizados por quem usa o Control ALL
    </p>
  );
}

// Marca para buscadores: nome oficial e as variações que as pessoas digitam
// ("control all", "controlall", "control+all"), ligadas ao mesmo site.
const jsonLdMarca = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Control ALL",
    alternateName: ["ControlALL", "Control All", "Control+All", "controlall", "Control ALL Finanças"],
    url: "https://www.controlall.com.br/",
    inLanguage: "pt-BR",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Control ALL",
    alternateName: ["ControlALL", "Control All", "controlall"],
    url: "https://www.controlall.com.br/",
    logo: "https://www.controlall.com.br/brand/og-cover.png",
    email: "contato@controlall.com.br",
  },
];

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

/** Contador de usuários na home (pedido de 2026-10-17: mostrar mesmo que o número seja baixo). */
function ContadorUsuarios({ className }: { className?: string }) {
  const contadorFn = useServerFn(contadorUsuariosPublico);
  const { data } = useQuery({ queryKey: ["contador-usuarios-home"], staleTime: 300_000, queryFn: () => contadorFn() });
  if (!data || data.total <= 0) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span>
        <b className="text-foreground">{data.total}</b> {data.total === 1 ? "pessoa já usa" : "pessoas já usam"} o Control ALL
        {data.novos30 > 0 && (
          <>
            {" · "}
            <b className="text-foreground">{data.novos30}</b> {data.novos30 === 1 ? "chegou" : "chegaram"} nos últimos 30 dias
          </>
        )}
      </span>
    </p>
  );
}

/** Mede até onde o visitante rolou a home (25, 50, 75 e 100%), uma vez por marco. */
function useRolagemHome() {
  useEffect(() => {
    const marcados = new Set<number>();
    const medir = () => {
      const alturaUtil = document.documentElement.scrollHeight - window.innerHeight;
      if (alturaUtil <= 0) return;
      const pct = (window.scrollY / alturaUtil) * 100;
      for (const marco of [25, 50, 75, 100]) {
        if (pct >= marco - 2 && !marcados.has(marco)) {
          marcados.add(marco);
          rastrearEvento("home_rolagem", { valor: marco });
        }
      }
    };
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);
}

/** Barra fixa no celular depois que o topo sai da tela: o botão de cadastro fica sempre à mão. */
function BarraCadastroCelular() {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const medir = () => setVisivel(window.scrollY > window.innerHeight * 0.8);
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur transition-transform sm:hidden",
        visivel ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Button asChild size="lg" className="h-12 w-full text-base font-semibold">
        <Link to="/entrar" search={{ criar: true }} onClick={cliqueCadastrar("barra-celular")}>
          Criar minha conta grátis <ArrowRight className="ml-2 size-4" />
        </Link>
      </Button>
    </div>
  );
}

const cliqueCadastrar = (origem: string) => () => rastrearEvento("clique_cadastrar", { caminho: `/#${origem}` });

function LandingPage() {
  const moduloLiberado = useModulosLiberados();
  const navigate = useNavigate();
  const videoUrl = useVideoDemonstracaoUrl();
  useRolagemHome();

  useEffect(() => {
    // No app do iPhone não existe página inicial do site: vai direto para o app
    // (Início se já estiver logado, senão o /inicio manda para Entrar/Criar conta).
    if (ehAppNativo()) {
      navigate({ to: "/inicio", replace: true });
      return;
    }
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdMarca) }}
      />
      <BannerOfertaHome />
      <SiteHeader home />

      {/* Hero (rework 04/11/2026, estrutura do protótipo aprovado) */}
      <section className="relative overflow-hidden">
        <div className="entrar-surge mx-auto flex max-w-5xl flex-col items-center px-5 pb-16 pt-14 text-center sm:pb-20 sm:pt-24">
          <BrandAnimado className="mb-6 hidden sm:flex" />
          <p className="text-base font-semibold text-primary sm:hidden">Control ALL</p>
          <h1 className="mt-2 max-w-5xl text-balance text-[2.75rem] font-extrabold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[6rem]">
            Quanto sobra no fim do mês.
            <span className="block text-primary">Sem planilha.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-2xl sm:leading-snug">
            Fale um gasto e a IA lança. Envie a fatura e veja quando cada parcela acaba. Notas fiscais e garantias no mesmo lugar, para toda a família. Grátis.
          </p>
          <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="h-14 w-full px-9 text-base font-bold sm:w-auto">
              <Link to="/entrar" search={{ criar: true }} onClick={cliqueCadastrar("hero")}>
                Criar conta grátis
              </Link>
            </Button>
            {videoUrl ? (
              <Button asChild size="lg" variant="outline" className="h-14 w-full border-primary px-9 text-base text-primary sm:w-auto">
                <a href="#demonstracao">
                  <PlayCircle className="mr-1 size-5" /> Ver demonstração
                </a>
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline" className="h-14 w-full border-primary px-9 text-base text-primary sm:w-auto">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            )}
          </div>
          <div className="mt-7 flex flex-col items-center gap-2">
            <EconomiaTotalBanner />
            <ContadorUsuarios />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check className="size-4 text-success" /> Gratuito</span>
            <span className="flex items-center gap-1.5"><Check className="size-4 text-success" /> Cadastro rápido</span>
            <span className="flex items-center gap-1.5"><Check className="size-4 text-success" /> Dados só seus</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
            <Link to="/calculadoras" className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Calculator className="size-4" /> Calculadoras grátis
            </Link>
          </div>
        </div>

        {/* Vitrine: o produto no notebook, no iPhone e no Android (dados de exemplo) */}
        <div className="px-4 pb-24 sm:pb-32">
          <VitrineDispositivos />
          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2">
            {modulos
              .filter((m) => m.titulo !== "Calculadoras gratuitas" && moduloLiberado(m.titulo))
              .map(({ icon: Icon, titulo }) => (
                <span key={titulo} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-sm text-muted-foreground">
                  <Icon className="size-4" /> {titulo}
                </span>
              ))}
          </div>
        </div>
      </section>

      {/* App no celular: os destaques de beta saíram do topo e vieram para cá */}
      <section id="app" className="scroll-mt-20 bg-[#0E1A2B] text-white native:hidden">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:py-28">
          <h2 className="text-balance text-4xl font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl">
            No iPhone, no Android e no computador.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">Uma conta, os mesmos dados em todo lugar. O app está em teste aberto.</p>
          <div className="mx-auto mt-10 max-w-4xl text-left text-foreground">
            <DestaquesBeta />
          </div>
        </div>
      </section>

      <ParceriaBloco />

      <PerdasInvisiveis />
      <ComoFunciona />

      {/* Recursos: grade de blocos (bento), sem bordas */}
      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:py-32">
        <h2 className="mx-auto max-w-3xl text-balance text-center text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          Organização que acompanha a vida real.
        </h2>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recursos.map(({ icon: Icon, titulo, texto }, i) => (
            <article
              key={titulo}
              className={cn(
                "group flex flex-col rounded-[2rem] bg-muted/70 p-8 transition-transform duration-300 hover:-translate-y-1",
                i === 0 && "sm:col-span-2 lg:row-span-2 lg:justify-end lg:p-10",
              )}
            >
              <span className={cn("grid place-items-center rounded-full bg-background text-primary", i === 0 ? "size-14" : "size-11")}>
                <Icon className={i === 0 ? "size-7" : "size-5"} />
              </span>
              <h3 className={cn("mt-6 font-extrabold tracking-[-0.02em]", i === 0 ? "text-3xl sm:text-4xl" : "text-xl")}>{titulo}</h3>
              <p className={cn("mt-2 leading-relaxed text-muted-foreground", i === 0 ? "max-w-md text-lg" : "text-[15px]")}>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Módulos: carrossel 3D de vidro */}
      <section id="modulos" className="scroll-mt-20 overflow-hidden bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <h2 className="text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Use só o que fizer sentido para a sua casa.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Cada módulo é independente. Comece pelas finanças e ative os outros quando precisar. Arraste para ver todos.
            </p>
          </div>
          <CarrosselModulos itens={modulos.filter((m) => moduloLiberado(m.titulo))} />
        </div>
      </section>

      {/* Notas e garantias: faixa inteira */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:py-32 md:grid-cols-2">
          <div>
            <p className="text-lg font-semibold text-primary">Notas fiscais e garantias</p>
            <h2 className="mt-3 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
              Notas e garantias, sem papel perdido.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Cadastre a nota, informe o prazo e deixe o Control ALL avisar quando a garantia estiver perto do fim. Tudo aparece também no calendário.
            </p>
          </div>
          <div className="rounded-[2.5rem] bg-muted/70 p-8 sm:p-12">
            <IlustracaoNotas className="mx-auto w-full max-w-sm" />
          </div>
        </div>
      </section>

      {/* Calendário: faixa escura */}
      <section className="bg-[#0E1A2B] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:py-32 md:grid-cols-2">
          <div className="order-2 rounded-[2.5rem] bg-white p-8 sm:p-12 md:order-1">
            <IlustracaoCalendario className="mx-auto w-full max-w-sm" />
          </div>
          <div className="order-1 md:order-2">
            <p className="text-lg font-semibold text-[#7DB6E8]">Calendário</p>
            <h2 className="mt-3 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
              O que vem por aí, mês a mês.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
              Faturas com o total, notas lançadas, fim de garantia e itens aprovados da lista de compras, num só calendário.
            </p>
          </div>
        </div>
      </section>

      {/* Demonstração (só aparece quando há vídeo publicado) */}
      {videoUrl && (
      <section id="demonstracao" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 text-center sm:py-32">
        <h2 className="text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">Veja antes de decidir.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">Uma apresentação rápida com dados fictícios, sem expor informações de ninguém.</p>
        <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-[2rem] bg-black shadow-[0_50px_100px_-40px_rgba(14,26,43,0.55)]">
          <video src={videoUrl} controls preload="metadata" className="aspect-video w-full" />
        </div>
      </section>
      )}

      {/* Educação financeira */}
      <section id="educacao-financeira" className="scroll-mt-20 bg-muted/50">
        <div className="mx-auto max-w-5xl px-4 py-24 sm:py-32">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <IlustracaoFamilia className="mx-auto mb-10 w-full max-w-sm" />
            <h2 className="text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
              Educação financeira para todas as idades.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Crianças, jovens, adultos e idosos podem aprender e usar juntos. Veja dicas práticas para cada fase da vida.
            </p>
          </div>
          <EducacaoFinanceira />
        </div>
      </section>

      {/* Preços */}
      <SegurancaBloco />
      <FaqBloco />

      <section id="precos" className="scroll-mt-20">
        <div className="mx-auto max-w-4xl px-4 py-28 text-center sm:py-40">
          <p className="text-lg font-semibold text-primary">Preço</p>
          <h2 className="mt-3 text-[4.5rem] font-extrabold leading-none tracking-[-0.06em] sm:text-[8rem]">Grátis.</h2>
          <p className="mx-auto mt-6 max-w-xl text-xl text-muted-foreground">
            {formatBRL(0)} por mês. Sem cartão de crédito. Seus dados ficam na sua conta.
          </p>
          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {[
              "Finanças, notas fiscais e lista de compras",
              "Calendário de faturas, garantias e compras",
              "Assistente de IA para lançar e resumir gastos",
              "Calculadoras e links temporários",
              "Seus dados ficam na sua conta",
            ].map((i) => (
              <li key={i} className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
                <Check className="size-4 shrink-0 text-success" /> {i}
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-12 h-14 px-10 text-base font-bold">
            <Link to="/entrar" search={{ criar: true }} onClick={cliqueCadastrar("precos")}>
              Criar conta grátis
            </Link>
          </Button>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-8">
        <AppEmBreve />
      </div>
      <BarraCadastroCelular />
      <SiteFooter />
    </main>
  );
}
