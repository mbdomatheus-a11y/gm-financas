import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  Calculator,
  Check,
  FileUp,
  Percent,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  QrCode,
  CalendarClock,
  Layers,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BrandAnimado } from "@/components/ferramentas/BrandAnimado";
import { BrandMark } from "@/components/BrandMark";
import { LegalDialogs } from "@/components/LegalDialogs";
import { SiteHeader } from "@/components/SiteHeader";
import { obterEstatisticaPublica } from "@/lib/estatisticas-site.functions";
import { obterParceriaHome, registrarCliqueParceria } from "@/lib/parceria.functions";
import { obterPrecoHome } from "@/lib/precos.functions";
import { formatBRL } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control ALL | Finanças Pessoais e Notas Fiscais Inteligentes" },
      {
        name: "description",
        content:
          "Controle completo de receitas, despesas, parcelamentos de cartão e leitura automática de notas fiscais com IA.",
      },
      {
        property: "og:title",
        content: "Control ALL | Seu dinheiro e notas fiscais organizados",
      },
      {
        property: "og:description",
        content:
          "Gerencie fluxo de caixa, parcelamentos de cartão, leia cupons fiscais do SEFAZ com IA e use calculadoras gratuitas.",
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
    titulo: "Finanças Pessoais Completas",
    destaque: "Principal",
    texto:
      "Receitas, despesas fixas e variáveis, projeção mensal e acompanhamento detalhado de parcelas.",
    detalhes: [
      "Fluxo de caixa inteligente mês a mês, com períodos customizáveis.",
      "Acompanhamento exato de parcelas futuras: saiba quando cada dívida termina.",
      "Importação e conferência de faturas de cartão com validação antes de lançar.",
      "Histórico de economia conquistada e conciliação automática.",
      "Compartilhamento seguro com familiares sem misturar contas.",
    ],
  },
  {
    icon: ReceiptText,
    titulo: "Notas Fiscais Inteligentes com IA",
    destaque: "Destaque",
    texto:
      "Escaneie cupons fiscais e QR Code do SEFAZ para extração automática de todos os itens e preços.",
    detalhes: [
      "Leitura rápida via QR Code ou chave de acesso da NF-e / NFC-e.",
      "Detalhamento automático de cada item: nome, quantidade, valor unitário e total.",
      "Guarda de comprovantes e notas de garantia direto no seu Google Drive.",
      "Alertas automáticos de garantia perto do vencimento para você nunca perder prazo.",
      "IA assistente que sumariza seus gastos e gera lançamentos com 1 clique.",
    ],
  },
  {
    icon: Calculator,
    titulo: "Calculadoras & Ferramentas Extras",
    destaque: "Bônus Gratuito",
    texto:
      "Calculadoras financeiras e utilitários úteis disponíveis para te apoiar em qualquer decisão.",
    detalhes: [
      "Calculadora CLT vs PJ completa com impostos e benefícios para comparar propostas.",
      "Simulador de Juros Compostos e Independência Financeira.",
      "Gamificação financeira: descubra quantas horas de trabalho cada compra exige.",
      "Links temporários com criptografia de ponta a ponta para compartilhar dados com segurança.",
      "Conversor e cotação de moedas em tempo real.",
    ],
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

function BlocoParceria() {
  const { data: parceria } = useParceriaHome();
  const registrarCliqueFn = useServerFn(registrarCliqueParceria);
  if (!parceria) return null;
  const previewUrl = parceria.previewImagemPath
    ? supabase.storage.from("site_assets").getPublicUrl(parceria.previewImagemPath).data.publicUrl
    : null;
  const linhas = parceria.slogan ? parceria.slogan.split("\n").filter(Boolean) : [];
  return (
    <a
      href={parceria.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => {
        registrarCliqueFn().catch(() => {});
      }}
      className="group mt-auto flex flex-col gap-2 rounded-xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 text-left shadow-sm transition-transform hover:scale-[1.02] dark:border-amber-500/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30"
    >
      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        Patrocinado
      </p>
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="h-40 w-full shrink-0 rounded-lg border object-cover shadow-sm"
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          {linhas[0] && (
            <p className="flex items-center gap-1.5 text-base font-bold leading-snug text-amber-700 dark:text-amber-400">
              <Percent className="size-4 shrink-0 animate-bounce" />
              <span className="truncate">{linhas[0]}</span>
            </p>
          )}
          {linhas[1] && (
            <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">{linhas[1]}</p>
          )}
        </div>
        <ArrowRight className="size-5 shrink-0 text-amber-600 transition-transform group-hover:translate-x-1 dark:text-amber-400" />
      </div>
    </a>
  );
}

const PRECO_PADRAO = {
  nome: "Control ALL Pro",
  preco: 4.99,
  sufixo: "/mês",
  descricao: "Acesso completo a Finanças, Notas Fiscais com IA e todas as calculadoras.",
  itens: [
    "Módulo de Finanças Pessoais sem limites",
    "Leitor de Notas Fiscais e QR Code SEFAZ com IA",
    "Previsão de fluxo de caixa e alívio de parcelas",
    "Guarda de comprovantes no Google Drive",
    "Calculadoras e ferramentas extras inclusas",
    "Privacidade total: seus dados são seus",
  ],
  botaoTexto: "Criar conta grátis",
};

function usePrecoHome() {
  const obterFn = useServerFn(obterPrecoHome);
  return useQuery({
    queryKey: ["preco-home-publica"],
    staleTime: 60_000,
    queryFn: () => obterFn(),
  });
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
    "Controle financeiro inteligente: receitas, despesas, parcelamentos e leitura automática de notas fiscais com IA.",
  offers: {
    "@type": "Offer",
    price: "4.99",
    priceCurrency: "BRL",
    priceValidUntil: "2027-12-31",
  },
  featureList: [
    "Controle de receitas e despesas",
    "Importação e conferência de faturas de cartão",
    "Leitor inteligente de notas fiscais com IA e SEFAZ",
    "Controle de parcelamentos e previsão de alívio",
    "Calculadoras financeiras gratuitas",
  ],
};

function LandingPage() {
  const navigate = useNavigate();
  const { data: precoData } = usePrecoHome();
  const preco = precoData ?? PRECO_PADRAO;

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

      {/* Hero Section */}
      <section className="overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_.9fr] md:py-24">
          <div className="flex flex-col justify-center">
            <BrandAnimado className="mb-5" />

            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-3.5" />
              Módulo de Finanças & Notas Fiscais com IA
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-5xl leading-tight">
              Seu dinheiro e suas notas fiscais, finalmente sob controle.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Abandone planilhas confusas e notas espalhadas. O <strong>Control ALL</strong> une
              fluxo de caixa inteligente, acompanhamento exato de parcelas e leitura instantânea de
              cupons fiscais via QR Code do SEFAZ com IA. Tudo em uma experiência simples, moderna e
              100% privada.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-sm font-semibold shadow-md">
                <Link to="/entrar" search={{ criar: true }}>
                  Criar minha conta grátis <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-5 text-sm">
                <Link to="/calculadoras">
                  <Calculator className="mr-2 size-4 text-primary" /> Usar calculadoras
                </Link>
              </Button>
            </div>

            <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" /> Sem fidelidade
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" /> Cadastro rápido sem burocracia
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" /> Seus dados protegidos
              </span>
            </div>
          </div>

          {/* Card Hero Demonstrativo */}
          <Card className="border-primary/20 bg-card/90 shadow-2xl backdrop-blur-sm">
            <CardContent className="flex h-full flex-col space-y-4 p-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Painel Financeiro
                  </span>
                  <p className="text-base font-bold">Resumo do Mês em Tempo Real</p>
                </div>
                <BrandMark className="size-10 opacity-90" />
              </div>

              {/* Indicadores */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-3.5 border border-emerald-500/20">
                  <p className="text-xs text-muted-foreground">Receitas do mês</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    R$ 8.240,00
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    ✓ Líquido disponível
                  </span>
                </div>
                <div className="rounded-xl bg-primary/10 p-3.5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Despesas + Parcelas</p>
                  <p className="text-lg font-bold text-foreground">R$ 5.190,00</p>
                  <span className="text-[10px] text-primary font-medium">Fixas + Variáveis</span>
                </div>
              </div>

              {/* Caixa de IA e Notas */}
              <div className="space-y-2.5 rounded-xl border bg-muted/40 p-4 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-2 text-primary">
                    <QrCode className="size-4" /> Cupom Fiscal lido via SEFAZ
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    IA Processou
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Supermercado · <strong>14 itens categorizados automaticamente</strong> (hortifrúti,
                  higiene e laticínios). Comprovante arquivado no Google Drive.
                </p>
              </div>

              {/* Alívio de Parcelas */}
              <div className="flex items-center justify-between rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs">
                <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-300">
                  <TrendingUp className="size-4 shrink-0" />
                  <span>Parcela 10/10 quitada este mês</span>
                </div>
                <span className="font-bold text-cyan-900 dark:text-cyan-200">+R$ 380 livres/mês</span>
              </div>

              <BlocoParceria />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção dos Módulos Principais */}
      <section id="modulos" className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">O QUE VOCÊ TEM NO CONTROL ALL</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Foco no que realmente importa para sua tranquilidade.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Projetado para dar clareza imediata às suas decisões financeiras e desburocratizar a
              guarda de comprovantes fiscais.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {modulos.map(({ icon: Icon, titulo, destaque, texto, detalhes }) => (
              <Card key={titulo} className="flex flex-col overflow-hidden border shadow-sm transition hover:shadow-md">
                <CardContent className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {destaque}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight">{titulo}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{texto}</p>

                  <ul className="mt-5 space-y-2 border-t pt-4 text-xs text-muted-foreground">
                    {detalhes.map((d) => (
                      <li key={d} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais / Por que escolher */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">DIFERENCIAIS</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Feito para a vida financeira real.</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Card className="border bg-card/50">
            <CardContent className="p-6">
              <ShieldCheck className="size-7 text-primary" />
              <h3 className="mt-4 font-bold text-base">Privacidade Absoluta</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Seus dados não são vendidos para anunciantes nem compartilhados com terceiros. O
                controle do que você vê e compartilha é 100% seu.
              </p>
            </CardContent>
          </Card>

          <Card className="border bg-card/50">
            <CardContent className="p-6">
              <Sparkles className="size-7 text-emerald-600" />
              <h3 className="mt-4 font-bold text-base">IA que Poupa Horas</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Não perca tempo digitando cada item de uma compra. Aponte a câmera pro QR Code e a IA
                extrai, separa e categoriza tudo em 3 segundos.
              </p>
            </CardContent>
          </Card>

          <Card className="border bg-card/50">
            <CardContent className="p-6">
              <CalendarClock className="size-7 text-cyan-600" />
              <h3 className="mt-4 font-bold text-base">Alívio de Parcelamentos</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Descubra com precisão quanto da sua renda vai ser liberada nos próximos meses à
                medida que compras antigas forem sendo quitadas.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção Preços / Comece Agora */}
      <section id="precos" className="border-t bg-primary/5">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">ACESSO COMPLETO</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Simples, transparente e acessível.
          </h2>

          <Card className="mx-auto mt-8 max-w-sm border-primary shadow-xl">
            <CardContent className="p-8">
              <p className="text-sm font-bold text-primary uppercase tracking-wider">{preco.nome}</p>
              <p className="mt-3 text-4xl font-extrabold">
                {formatBRL(preco.preco)}
                <span className="text-base font-normal text-muted-foreground">{preco.sufixo}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{preco.descricao}</p>

              <ul className="mt-6 space-y-2.5 text-left text-xs text-muted-foreground border-y py-4">
                {preco.itens.map((i) => (
                  <li className="flex items-center gap-2" key={i}>
                    <Check className="size-4 shrink-0 text-emerald-600" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>

              <Button asChild size="lg" className="mt-6 w-full font-semibold">
                <Link to="/entrar" search={{ criar: true }}>
                  {preco.botaoTexto}
                </Link>
              </Button>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Cancele quando quiser. Sem taxa de adesão.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-6 py-8 text-xs text-muted-foreground max-w-6xl mx-auto">
        <p>© {new Date().getFullYear()} Control ALL LTDA. Todos os direitos reservados.</p>
        <div className="flex items-center gap-4">
          <Link to="/calculadoras" className="hover:underline">Calculadoras</Link>
          <LegalDialogs compact />
        </div>
      </footer>
    </main>
  );
}
