import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Check, FileUp, ReceiptText, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { contadorUsuariosPublico } from "@/lib/funil.functions";
import { rastrearEvento } from "@/lib/funil-cliente";

/**
 * Páginas de entrada por assunto (2026-10-17, plano de retenção): cada post do Instagram
 * aponta para a página do tema do post, com um único botão de cadastro na primeira tela.
 */
type Assunto = {
  titulo: string;
  destaque: string;
  subtitulo: string;
  icone: typeof CalendarClock;
  pontos: string[];
  passos: string[];
  seoTitulo: string;
  seoDescricao: string;
};

const ASSUNTOS: Record<string, Assunto> = {
  parcelas: {
    titulo: "Descubra em que mês",
    destaque: "suas parcelas acabam.",
    subtitulo: "Envie a fatura do cartão e veja, mês a mês, quanto do seu orçamento volta a ficar livre.",
    icone: CalendarClock,
    pontos: [
      "Todas as compras parceladas em uma lista só",
      "Quanto sobra a mais em cada mês que uma parcela termina",
      "Aviso quando a última parcela chega",
    ],
    passos: ["Crie sua conta grátis", "Envie o PDF da fatura do cartão", "Veja o calendário das parcelas"],
    seoTitulo: "Quando acabam minhas parcelas? Controle de parcelamentos | Control ALL",
    seoDescricao: "Envie a fatura do cartão e veja em que mês cada parcela termina e quanto sobra no orçamento. Grátis.",
  },
  fatura: {
    titulo: "A fatura do cartão",
    destaque: "organizada em 1 minuto.",
    subtitulo: "Envie o PDF da fatura: as compras entram separadas por categoria e você confere antes de salvar.",
    icone: FileUp,
    pontos: [
      "Lê faturas de Nubank, Itaú, Santander, Pernambucanas e outros",
      "Separa por categoria e por cartão",
      "Mostra o total do mês e o que vence a seguir",
    ],
    passos: ["Crie sua conta grátis", "Envie o PDF da fatura", "Confira e salve"],
    seoTitulo: "Organizar a fatura do cartão de crédito | Control ALL",
    seoDescricao: "Envie o PDF da fatura do cartão e veja suas compras separadas por categoria, com parcelas e vencimentos. Grátis.",
  },
  notas: {
    titulo: "Notas fiscais e garantias",
    destaque: "sem papel perdido.",
    subtitulo: "Guarde a nota, informe o prazo e receba o aviso antes de a garantia acabar.",
    icone: ReceiptText,
    pontos: [
      "Foto ou PDF da nota guardados na sua conta",
      "Aviso antes do fim da garantia",
      "Busca por produto ou loja",
    ],
    passos: ["Crie sua conta grátis", "Fotografe ou envie a nota", "Receba o aviso da garantia"],
    seoTitulo: "Guardar notas fiscais e controlar garantias | Control ALL",
    seoDescricao: "Guarde suas notas fiscais e receba aviso antes do fim da garantia. Grátis e sem papel.",
  },
};

export const Route = createFileRoute("/comecar/$assunto")({
  loader: ({ params }) => {
    if (!ASSUNTOS[params.assunto]) throw notFound();
    return null;
  },
  head: ({ params }) => {
    const a = ASSUNTOS[params.assunto];
    if (!a) return {};
    const url = `https://www.controlall.com.br/comecar/${params.assunto}`;
    return {
      meta: [
        { title: a.seoTitulo },
        { name: "description", content: a.seoDescricao },
        { property: "og:title", content: a.seoTitulo },
        { property: "og:description", content: a.seoDescricao },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PaginaAssunto,
});

function PaginaAssunto() {
  const { assunto } = Route.useParams();
  const a = ASSUNTOS[assunto]!;
  const Icone = a.icone;
  const contadorFn = useServerFn(contadorUsuariosPublico);
  const { data: contador } = useQuery({ queryKey: ["contador-usuarios-home"], staleTime: 300_000, queryFn: () => contadorFn() });
  useEffect(() => {
    const marcados = new Set<number>();
    const medir = () => {
      const util = document.documentElement.scrollHeight - window.innerHeight;
      if (util <= 0) return;
      const pct = (window.scrollY / util) * 100;
      for (const m of [50, 100]) if (pct >= m - 2 && !marcados.has(m)) {
        marcados.add(m);
        rastrearEvento("home_rolagem", { valor: m });
      }
    };
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);
  const clique = () => rastrearEvento("clique_cadastrar", { caminho: `/comecar/${assunto}` });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-8 sm:py-16">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icone className="size-6" />
          </span>
          <h1 className="mt-4 text-[2.1rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            {a.titulo} <span className="text-gradient-brand">{a.destaque}</span>
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{a.subtitulo}</p>
          <Button asChild size="lg" className="mt-6 h-12 w-full text-base font-semibold sm:w-auto">
            <Link to="/entrar" search={{ criar: true }} onClick={clique}>
              Começar grátis <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          {contador && contador.total > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              <b className="text-foreground">{contador.total}</b> pessoas já usam o Control ALL
            </p>
          )}
          <ul className="mt-6 space-y-2 text-sm">
            {a.pontos.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <p className="eyebrow">Como funciona</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {a.passos.map((p, i) => (
            <li key={p} className="rounded-xl border bg-card p-4 text-sm">
              <span className="mb-2 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" /> Também dá para lançar falando
          </p>
          <p className="mt-1">Diga "mercado, 85 reais no cartão" e a IA monta o lançamento para você conferir.</p>
        </div>
        <Button asChild size="lg" className="mt-8 h-12 w-full text-base font-semibold sm:w-auto">
          <Link to="/entrar" search={{ criar: true }} onClick={clique}>
            Criar minha conta grátis <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <p className="mt-6 text-xs text-muted-foreground">
          <Link to="/" className="underline-offset-2 hover:underline">Conhecer tudo o que o Control ALL faz</Link>
        </p>
      </section>
    </main>
  );
}
