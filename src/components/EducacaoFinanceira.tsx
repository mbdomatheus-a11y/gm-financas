import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Faixa = { id: string; titulo: string; dicas: string[] };

/** Item 11 (2026-10-05): conteúdo de educação financeira para todas as idades. */
const FAIXAS: Faixa[] = [
  {
    id: "criancas",
    titulo: "Crianças (até 11 anos)",
    dicas: [
      "Conversar sobre dinheiro com naturalidade: de onde ele vem (trabalho) e para onde vai.",
      "Usar três potinhos: gastar, guardar e doar. A criança vê o dinheiro crescer ou acabar.",
      "Deixar escolher entre duas coisas pequenas e viver o resultado da escolha.",
      "Ensinar a esperar: juntar para algo que ela quer ensina mais que ganhar de presente.",
    ],
  },
  {
    id: "adolescentes",
    titulo: "Adolescentes (12 a 17 anos)",
    dicas: [
      "Mesada com combinados claros, para aprender a planejar um valor fixo até o fim do mês.",
      "Diferença entre querer e precisar, e como a propaganda e as redes sociais influenciam compras.",
      "Primeiros conceitos: juros, poupança, golpes digitais e senhas de aplicativos de banco.",
      "Registrar o que entra e o que sai, mesmo que seja só um caderno ou este site.",
    ],
  },
  {
    id: "jovens",
    titulo: "Jovens adultos (18 a 35 anos)",
    dicas: [
      "Montar a reserva de emergência: de 3 a 6 meses do custo de vida, em algo de liquidez diária.",
      "Cartão de crédito é ferramenta, não renda extra. Pague sempre a fatura inteira.",
      "Fugir das dívidas caras (rotativo e cheque especial) antes de qualquer investimento.",
      "Começar a investir aos poucos, com aportes mensais, e pensar na aposentadoria cedo.",
    ],
  },
  {
    id: "adultos",
    titulo: "Adultos e famílias (36 a 59 anos)",
    dicas: [
      "Planejar o orçamento da casa em conjunto, com metas claras para estudos, moradia e viagens.",
      "Proteger a família: seguro de vida e de saúde quando fizer sentido, e organizar documentos.",
      "Revisar assinaturas, tarifas e contratos uma vez por ano para cortar o que não usa.",
      "Equilibrar a ajuda a filhos e pais sem comprometer a própria aposentadoria.",
    ],
  },
  {
    id: "maduros",
    titulo: "60 anos ou mais",
    dicas: [
      "Conhecer a renda real da aposentadoria e ajustar o padrão de vida a ela.",
      "Cuidado redobrado com golpes por telefone, mensagem e empréstimo consignado oferecido na porta.",
      "Manter dinheiro de fácil acesso para saúde e imprevistos.",
      "Conversar com a família sobre herança e organização patrimonial, com calma e sem pressa.",
    ],
  },
];

const PRINCIPIOS = [
  "Gaste menos do que ganha e registre tudo.",
  "Primeiro pague a si mesmo: separe a reserva assim que o dinheiro entrar.",
  "Antes de comprar, pergunte quantas horas de trabalho aquilo custa.",
  "Planeje as parcelas: o que parece pequeno por mês pesa no conjunto.",
  "Nunca compartilhe senhas ou códigos, e desconfie de promessas de ganho fácil.",
];

export function EducacaoFinanceira() {
  return (
    <Card className="mb-8">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-4.5 text-primary" /> Educação financeira para todas as idades
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Conteúdo para quem está começando e também para quem já tem experiência. Escolha a
          faixa de idade e veja dicas práticas, que valem para toda a família.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {PRINCIPIOS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Accordion type="single" collapsible className="w-full">
          {FAIXAS.map((f) => (
            <AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger className="text-sm">{f.titulo}</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {f.dicas.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="text-[11px] text-muted-foreground">
          Conteúdo educativo geral, sem recomendação de investimento ou aconselhamento financeiro
          individual.
        </p>
      </CardContent>
    </Card>
  );
}
