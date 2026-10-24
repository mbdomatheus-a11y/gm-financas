import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Car,
  FileText,
  HeartHandshake,
  Landmark,
  Lock,
  Mic,
  PawPrint,
  ShoppingCart,
  Stethoscope,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Control ALL" },
      {
        name: "description",
        content:
          "Como a planilha de finanças de um casal virou o Control ALL: finanças, notas fiscais com garantia e lista de compras num lugar só, no site e no iPhone.",
      },
    ],
  }),
  component: SobrePage,
});

// História contada pelo Matheus em 24/10/2026.

const HOJE = [
  {
    icone: Wallet,
    titulo: "Finanças da casa",
    texto: "Receitas, despesas, cartões e bancos, com cada parcela mostrando quando acaba. Investimentos e caixinhas para as metas.",
  },
  {
    icone: FileText,
    titulo: "Fatura sem digitar",
    texto: "Envie o PDF da fatura do cartão e os lançamentos entram sozinhos, já separados por categoria.",
  },
  {
    icone: Mic,
    titulo: "Lançar falando",
    texto: "Diga \"mercado, 85 reais no cartão\" e a IA monta o lançamento. Você só confere e salva.",
  },
  {
    icone: Bell,
    titulo: "Notas fiscais e garantias",
    texto: "A nota fica guardada pela chave de acesso e o app avisa antes da garantia acabar.",
  },
  {
    icone: ShoppingCart,
    titulo: "Lista de compras com aprovação",
    texto: "Um adiciona, o outro aprova. Ninguém compra a mesma coisa duas vezes.",
  },
  {
    icone: CalendarClock,
    titulo: "Calendário do mês",
    texto: "Vencimentos, últimas parcelas e garantias num calendário que vai até o seu iPhone.",
  },
  {
    icone: Users,
    titulo: "Para a casa toda",
    texto: "Cada pessoa entra com a própria conta e vê só o que foi liberado para ela.",
  },
  {
    icone: Wrench,
    titulo: "Ferramentas grátis",
    texto: "Calculadoras do dia a dia e link temporário para compartilhar algo que some sozinho.",
  },
];

const EM_BREVE = [
  { icone: PawPrint, texto: "Pets: vacinas, reforços e cuidados" },
  { icone: Car, texto: "Veículos: manutenção, documentos e IPVA" },
  { icone: Stethoscope, texto: "Exames da família num lugar seguro" },
  { icone: Landmark, texto: "Bancos conectados pelo Open Finance" },
];

function SobrePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-16 text-center sm:pt-20">
          <p className="eyebrow justify-center">Nossa história</p>
          <h1 className="mt-3 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            Começou numa planilha. Cabe no seu bolso.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
            O Control ALL nasceu de uma reunião de finanças que acontecia toda semana na nossa casa. Esta é a história de
            como ela virou um app.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-16 px-4 py-14">
        <section className="space-y-4 text-[1.05rem] leading-8">
          <h2 className="text-2xl font-bold tracking-tight">Como tudo começou</h2>
          <p>
            Nós, Matheus e Guilherme, sempre fomos muito controlados com dinheiro. Cada gasto anotado, cada parcela
            acompanhada, tudo numa planilha que a gente mesmo montou e foi ajustando com o tempo.
          </p>
          <p>
            Toda semana tinha a nossa <strong>reunião de finanças</strong>: sentávamos no computador, atualizávamos as
            despesas da semana e combinávamos as metas até o fim da semana ou até a virada do cartão. Funcionava. Só que
            um problema nunca ia embora: no celular, a planilha era um sofrimento. Lançar um café na fila da padaria
            virava missão, e muita coisa ficava para depois. E depois, a gente esquecia.
          </p>
          <blockquote className="border-l-4 border-primary pl-5 text-xl font-semibold leading-8 text-foreground">
            Foi dessa dor que nasceu o Control ALL: um app para substituir a planilha, que coubesse no bolso e que os dois
            pudessem usar ao mesmo tempo.
          </blockquote>
        </section>

        <section className="space-y-4 text-[1.05rem] leading-8">
          <h2 className="text-2xl font-bold tracking-tight">Quando a planilha ficou pequena</h2>
          <p>
            Bastou começar a usar para perceber que outras coisas também nos incomodavam. E se desse para resolver tudo no
            mesmo lugar? A ideia foi crescendo e virou um superapp, que segue em construção.
          </p>
          <p>
            A primeira grande dor foi a das notas fiscais. Toda vez que um eletrodoméstico quebrava era o mesmo desespero:
            onde está a nota? Ainda está na garantia? Hoje cada nota fica guardada, a garantia aparece no calendário e a
            gente sabe na hora se dá para acionar.
          </p>
          <p>
            Depois veio a lista de compras com aprovação do casal. Um coloca o item, o outro aprova, e acabaram as compras
            em dobro e as surpresas na fatura.
          </p>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">O que já dá para fazer hoje</h2>
            <p className="mt-1 text-muted-foreground">No site e no app para iPhone, com a mesma conta.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {HOJE.map((h) => (
              <div key={h.titulo} className="flex gap-3 rounded-2xl border bg-card p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <h.icone className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{h.titulo}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{h.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border bg-muted/40 p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">O que vem por aí</h2>
          <p className="text-[1.05rem] leading-8">
            O Control ALL ainda está em desenvolvimento, e a lista de ideias só cresce. Algumas partes já estão em teste e
            logo chegam para todo mundo:
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {EM_BREVE.map((e) => (
              <li key={e.texto} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5 text-sm">
                <e.icone className="size-4 shrink-0 text-primary" />
                {e.texto}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 text-[1.05rem] leading-8">
          <h2 className="text-2xl font-bold tracking-tight">Feito por quem usa</h2>
          <p>
            A gente usa o Control ALL todos os dias, na nossa casa. Cada melhoria nasce de uma dor real, nossa ou de quem
            está usando com a gente. Tem uma ideia ou algo que te incomoda? Conta pra gente em{" "}
            <a className="font-medium text-primary underline" href="mailto:contato@controlall.com.br">
              contato@controlall.com.br
            </a>
            .
          </p>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border p-4">
              <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-6">
                <strong>Seus dados são seus.</strong> Não vendemos dados e não mostramos anúncios.
              </p>
            </div>
            <div className="flex gap-3 rounded-2xl border p-4">
              <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-6">
                <strong>Sem letra miúda.</strong> Os Termos dizem, módulo por módulo, o que guardamos e quem vê.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-primary px-6 py-10 text-center text-primary-foreground">
          <p className="text-2xl font-bold tracking-tight">Que tal trocar a planilha também?</p>
          <p className="mx-auto mt-2 max-w-md opacity-90">
            Suas finanças e sua casa, tudo num lugar só. Entre com sua conta no app e no site. Grátis.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/entrar" search={{ criar: true }}>
              Criar minha conta grátis <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Feito no Brasil ·{" "}
          <Link to="/termos-de-uso" className="underline">Termos</Link> ·{" "}
          <Link to="/privacidade" className="underline">Privacidade</Link> ·{" "}
          <Link to="/cookies" className="underline">Cookies</Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
