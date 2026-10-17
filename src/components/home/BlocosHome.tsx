import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, EyeOff, FileUp, LockKeyhole, ShieldCheck, Sparkles, Trash2, Wallet } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import { rastrearEvento } from "@/lib/funil-cliente";

const cliqueCadastrar = (origem: string) => () =>
  rastrearEvento("clique_cadastrar", { caminho: `/#${origem}` });

/** Cabeçalho editorial das seções: número + rótulo, título e subtítulo. */
function CabecalhoSecao({
  numero,
  rotulo,
  titulo,
  subtitulo,
}: {
  numero: string;
  rotulo: string;
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="eyebrow">
        Nº {numero} · {rotulo}
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h2>
      {subtitulo && <p className="mt-3 text-base leading-7 text-muted-foreground">{subtitulo}</p>}
    </div>
  );
}

/** Estimativa de quanto escapa por mês. Tudo fica no aparelho, nada é enviado. */
export function PerdasInvisiveis() {
  const [v, setV] = useState({ assinaturas: 60, impulso: 200, juros: 40 });
  const campo = (chave: keyof typeof v, rotulo: string, dica: string) => (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{rotulo}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={v[chave]}
          onChange={(e) => setV({ ...v, [chave]: Math.max(0, Number(e.target.value) || 0) })}
          className="h-12 pl-9 text-base"
        />
      </div>
      <span className="block text-xs text-muted-foreground">{dica}</span>
    </label>
  );
  const mes = v.assinaturas + v.impulso + v.juros;
  return (
    <section id="perdas" className="scroll-mt-20 border-b bg-amber-50/50 dark:bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <CabecalhoSecao
          numero="01"
          rotulo="Perdas invisíveis"
          titulo="Você trabalha, recebe e gasta. E no fim, quanto escapou?"
          subtitulo="Assinaturas esquecidas, compras por impulso e juros de atraso somem sem você perceber. Faça uma estimativa rápida."
        />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              {campo("assinaturas", "Assinaturas esquecidas", "Apps, streaming, planos que você não usa")}
              {campo("impulso", "Compras por impulso", "O que você não compraria com a cabeça fria")}
              {campo("juros", "Juros e multas", "Atrasos de fatura e boletos")}
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-card">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estimativa de perda por mês
                </p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight text-destructive">−{formatBRL(mes)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Em um ano, são <strong className="text-foreground">{formatBRL(mes * 12)}</strong>.
                </p>
              </div>
              <Button asChild size="lg" className="h-12 w-full font-semibold">
                <Link to="/entrar" search={{ criar: true }} onClick={cliqueCadastrar("perdas")}>
                  Ver onde meu dinheiro vai <ArrowRight className="size-4" />
                </Link>
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Estimativa feita por você neste aparelho. Nada é enviado.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

const PASSOS = [
  {
    icon: FileUp,
    title: "Lance do seu jeito",
    description: "Fale ou escreva um gasto, envie a fatura do cartão ou fotografe a nota fiscal.",
  },
  {
    icon: Sparkles,
    title: "A IA organiza",
    description: "Categoriza, separa fixas e parcelas, mostra quando cada parcela acaba e guarda as garantias.",
  },
  {
    icon: Wallet,
    title: "Você decide",
    description: "Veja quanto sobra no fim do mês, receba avisos antes do problema e planeje com calma.",
  },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-16">
      <CabecalhoSecao numero="02" rotulo="Como funciona" titulo="Você faz uma coisa só. A gente cuida do resto." />
      <ol className="grid gap-4 md:grid-cols-3">
        {PASSOS.map(({ icon: Icon, title, description }, i) => (
          <li key={title}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

const SEGURANCA = [
  {
    icon: EyeOff,
    title: "Sem senha do banco",
    description: "Você não precisa informar login nem senha de nenhum banco. Lance, importe a fatura ou fotografe a nota.",
  },
  {
    icon: LockKeyhole,
    title: "Seus dados são só seus",
    description: "Cada conta enxerga apenas os próprios dados. Compartilhar com a família é uma escolha sua.",
  },
  {
    icon: ShieldCheck,
    title: "Não vendemos dados",
    description: "Não vendemos nem repassamos seus dados para publicidade. Tratamento conforme a LGPD.",
  },
  {
    icon: Trash2,
    title: "Você manda nos seus dados",
    description: "Pode pedir a exclusão da conta quando quiser, direto no site.",
  },
];

export function SegurancaBloco() {
  return (
    <section id="seguranca" className="scroll-mt-20 border-y bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <CabecalhoSecao
          numero="03"
          rotulo="Segurança"
          titulo="Cuidar do seu dinheiro começa por cuidar dos seus dados."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEGURANCA.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardContent className="p-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-3 text-base font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const PERGUNTAS = [
  {
    title: "O Control ALL é mesmo gratuito?",
    description: "Sim. Você cria a conta e usa os módulos liberados sem cobrança.",
  },
  {
    title: "Preciso conectar minha conta do banco?",
    description:
      "Não. Você lança por voz ou texto, importa a fatura do cartão ou fotografa a nota fiscal. Nunca pedimos a senha do seu banco.",
  },
  {
    title: "Funciona no celular?",
    description: "Sim. O site é feito para o celular e pode ser instalado na tela inicial como um aplicativo.",
  },
  {
    title: "Posso usar com a minha família?",
    description: "Pode. Você convida familiares e escolhe o que cada pessoa enxerga.",
  },
  {
    title: "Como excluo meus dados?",
    description: "Em Minha Conta você pede a exclusão. Também atendemos pelo canal de privacidade, conforme a LGPD.",
  },
];

export function FaqBloco() {
  return (
    <section id="perguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14 sm:py-16">
      <CabecalhoSecao numero="04" rotulo="Perguntas" titulo="Perguntas frequentes" />
      <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
        {PERGUNTAS.map(({ title, description }) => (
          <AccordionItem key={title} value={title}>
            <AccordionTrigger className="text-left text-base font-semibold">{title}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
