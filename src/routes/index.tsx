import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BellRing, Check, FileHeart, FileUp, ListChecks, MapPin, PawPrint, PlayCircle, ReceiptText, Search, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BrandAnimado } from "@/components/ferramentas/BrandAnimado";
import { BrandMark } from "@/components/BrandMark";
import { LegalDialogs } from "@/components/LegalDialogs";
import { SiteHeader } from "@/components/SiteHeader";
import { consultarProtocolo } from "@/lib/central-solicitacoes.functions";
import { obterEstatisticaPublica } from "@/lib/estatisticas-site.functions";
import { formatBRL } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Control ALL | Organização financeira e da vida" },
    { name: "description", content: "Organize finanças, documentos, rotina da família, pets e exames em um só lugar." },
    { property: "og:title", content: "Control ALL | Tudo da sua vida, organizado" },
    { property: "og:description", content: "Controle finanças, lista, documentos, pets, exames e lembretes." },
  ], links: [{ rel: "canonical", href: "https://www.controlall.com.br/" }] }), component: LandingPage,
});

const modulos = [
  {
    icon: Wallet,
    titulo: "Finanças",
    texto: "Receitas, despesas, cartões, investimentos e faturas importadas com revisão.",
    detalhes: [
      "Fluxo de caixa mês a mês, com período personalizado.",
      "Importação de faturas de cartão com revisão antes de confirmar.",
      "Conciliação automática de contas vencidas e economia conquistada.",
      "Compartilhamento com quem você escolher.",
    ],
  },
  {
    icon: ListChecks,
    titulo: "Lista de Compras",
    texto: "Compras compartilhadas, links de referência e aprovações.",
    detalhes: [
      "Até 4 links de referência por item (Instagram, TikTok, loja, etc.).",
      "Aprovação em grupo antes de marcar como comprado.",
      "Histórico do que já foi comprado.",
    ],
  },
  {
    icon: ReceiptText,
    titulo: "Notas fiscais",
    texto: "Guarde comprovantes, garantias e lembretes de vencimento.",
    detalhes: [
      "Fotos e PDFs organizados por compra.",
      "Salva direto no seu Google Drive — sem custo de armazenamento extra.",
      "Lembretes de garantia perto do vencimento.",
    ],
  },
  {
    icon: PawPrint,
    titulo: "Pet",
    texto: "Carteira de vacinação, vermifugação, dados do animal e alertas.",
    detalhes: [
      "Carteirinha digital por pet.",
      "Alertas de próxima dose e vermifugação.",
      "Histórico completo de saúde.",
    ],
  },
  {
    icon: MapPin,
    titulo: "Onde está?",
    texto: "Local, cômodo e detalhe de onde cada item está guardado — com busca rápida.",
    detalhes: [
      "Cadastre local, cômodo, caixa/gaveta e até validade — tudo opcional.",
      "Busque por nome do item (\"pilha AAA\") e veja onde está guardado.",
      "Simples de preencher só com o que você souber no momento.",
    ],
  },
  {
    icon: FileHeart,
    titulo: "Exames",
    texto: "Histórico privado, anexos e evolução de resultados com seu aceite.",
    detalhes: [
      "Anexe resultados e acompanhe a evolução.",
      "Privado por padrão — nada é compartilhado sem seu aceite.",
      "Organização por data e tipo de exame.",
    ],
  },
];

const STATUS_LABEL: Record<string, string> = {
  recebida: "Recebida", recebido: "Recebido",
  em_analise: "Em Análise", em_atendimento: "Em Atendimento",
  aguardando_ti: "Aguardando TI", planejado: "Planejado", programado: "Programado",
  concluida: "Concluída", concluido: "Concluído", indeferida: "Indeferida",
  aguardando_usuario: "Aguardando usuário", resolvido: "Resolvido", cancelado: "Cancelado",
};

function ConsultaProtocolo() {
  const [modo, setModo] = useState<"protocolo" | "cpf">("protocolo");
  const [protocolo, setProtocolo] = useState("");
  const [cpf, setCpf] = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const consultarFn = useServerFn(consultarProtocolo);

  function formatarCpfInput(v: string) {
    return v.replace(/\D/g, "").slice(0, 11);
  }

  async function buscar() {
    const isProtocolo = modo === "protocolo";
    const val = isProtocolo ? protocolo.trim() : cpf.replace(/\D/g, "");
    if (!val) return;
    setCarregando(true);
    setBuscado(false);
    setResultado(null);
    try {
      const res = await consultarFn({
        data: isProtocolo ? { protocolo: val } : { cpf: val },
      });
      setResultado(res);
    } catch (e: any) {
      toast.error(e.message || "Não encontrado ou formato inválido.");
    } finally {
      setCarregando(false);
      setBuscado(true);
    }
  }

  const resultados = Array.isArray(resultado) ? resultado : resultado ? [resultado] : [];

  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <p className="text-sm font-semibold text-primary">SUPORTE E PRIVACIDADE</p>
        <h2 className="mt-2 text-2xl font-bold">Consultar status de solicitação</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe o protocolo recebido ao enviar uma solicitação ou consulte pelo seu CPF.
        </p>

        {/* Abas de modo */}
        <div className="mt-5 flex gap-2">
          <Button
            size="sm"
            variant={modo === "protocolo" ? "default" : "outline"}
            onClick={() => { setModo("protocolo"); setBuscado(false); setResultado(null); }}
          >
            Por Protocolo
          </Button>
          <Button
            size="sm"
            variant={modo === "cpf" ? "default" : "outline"}
            onClick={() => { setModo("cpf"); setBuscado(false); setResultado(null); }}
          >
            Por CPF
          </Button>
        </div>

        <div className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row">
          {modo === "protocolo" ? (
            <Input
              placeholder="Cole o protocolo aqui (UUID)"
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
            />
          ) : (
            <Input
              placeholder="Somente os 11 dígitos do CPF"
              value={cpf}
              onChange={(e) => setCpf(formatarCpfInput(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              maxLength={11}
            />
          )}
          <Button
            onClick={buscar}
            disabled={carregando || (modo === "protocolo" ? !protocolo.trim() : cpf.replace(/\D/g, "").length < 11)}
          >
            <Search className="size-4 mr-1.5" />{carregando ? "Consultando…" : "Consultar"}
          </Button>
        </div>

        {buscado && (
          resultados.length > 0 ? (
            <div className="mt-5 max-w-md space-y-3">
              {resultados.map((res: any, i: number) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-mono truncate">{res.protocolo}</p>
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shrink-0 ml-2">
                        {res.tipo === "privacidade" ? "Privacidade" : "Suporte"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 text-sm font-semibold">{STATUS_LABEL[res.status] ?? res.status}</span>
                      <span className="text-xs text-muted-foreground">{res.dias_aberto} dia(s) em aberto</span>
                    </div>
                    {res.resposta && <p className="text-sm text-muted-foreground italic">"{res.resposta}"</p>}
                    <p className="text-xs text-muted-foreground">Última atualização: {new Date(res.atualizado_em).toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma solicitação encontrada com esse {modo === "protocolo" ? "protocolo" : "CPF"}.</p>
          )
        )}
      </div>
    </section>
  );
}

function useVideoDemonstracaoUrl() {
  const { data: path } = useQuery({
    queryKey: ["identidade-visual-site-video"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("identidade_visual_site")
        .select("video_demonstracao_path")
        .eq("id", true)
        .maybeSingle();
      return (data?.video_demonstracao_path as string | null | undefined) ?? null;
    },
  });
  return typeof path === "string" && path
    ? supabase.storage.from("site_videos").getPublicUrl(path).data.publicUrl
    : null;
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
        <span className="text-muted-foreground">já economizados por quem usa o Control ALL, em assinaturas e contas ajustadas.</span>
      </div>
    </section>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const videoUrl = useVideoDemonstracaoUrl();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/inicio" }); }); }, [navigate]);
  return <main className="min-h-screen bg-background text-foreground">
    <SiteHeader home />
    <EconomiaTotalBanner />
    <section className="overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background"><div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_.9fr] md:py-24">
      <div className="flex flex-col justify-center"><BrandAnimado className="mb-5" /><p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium"><Sparkles className="size-3.5 text-primary" /> Uma casa mais leve começa com clareza</p><h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">A vida da sua família organizada em um só lugar.</h1><p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">Do dinheiro aos documentos, do pet aos exames: o Control ALL transforma tarefas espalhadas em uma rotina simples, privada e compartilhável quando você quiser. Notas fiscais ficam salvas direto no seu Google Drive, contas vencidas se conciliam automaticamente e você ainda pode enviar links temporários criptografados sem precisar de conta.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/entrar">Começar agora <ArrowRight className="size-4" /></Link></Button><Button asChild size="lg" variant="outline"><a href="#demonstracao"><PlayCircle className="size-4" /> Ver demonstração</a></Button></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2"><Link to="/calculadoras" className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/20">Usar calculadoras gratuitas <ArrowRight className="size-4" /></Link><Link to="/links-temporarios" className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/20">Enviar link temporário <ArrowRight className="size-4" /></Link></div><p className="mt-3 text-xs text-muted-foreground">R$ 4,99 por mês. Cobrança será habilitada no lançamento comercial.</p></div>
      <Card className="border-primary/20 bg-card/80 shadow-xl"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Visão de exemplo</p><b>Seu mês em ordem</b></div><BrandMark className="size-11 opacity-90" /></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xs text-muted-foreground">Entradas</p><b className="text-emerald-700">R$ 8.240,00</b></div><div className="rounded-xl bg-primary/10 p-3"><p className="text-xs text-muted-foreground">Planejado</p><b>R$ 5.190,00</b></div></div><div className="space-y-2 rounded-xl border p-3 text-sm"><p className="font-medium">Próximos cuidados</p><p className="flex items-center gap-2 text-muted-foreground"><BellRing className="size-4 text-primary" /> Garantia do liquidificador em 12 dias</p><p className="flex items-center gap-2 text-muted-foreground"><PawPrint className="size-4 text-primary" /> Reforço da vacina do pet em breve</p><p className="flex items-center gap-2 text-muted-foreground"><FileHeart className="size-4 text-primary" /> 3 resultados aguardando revisão</p></div><p className="text-center text-xs text-muted-foreground">Dados fictícios para demonstração.</p></CardContent></Card>
    </div></section>
    <section id="recursos" className="mx-auto max-w-6xl px-4 py-16"><div className="mb-8 max-w-2xl"><p className="text-sm font-semibold text-primary">RECURSOS</p><h2 className="mt-2 text-3xl font-bold">Organização que acompanha a vida real.</h2></div><div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><ShieldCheck className="size-6 text-primary"/><h3 className="mt-3 font-semibold">Privacidade por padrão</h3><p className="mt-1 text-sm text-muted-foreground">Dados pessoais e exames privados. Compartilhamento só com a sua escolha.</p></CardContent></Card><Card><CardContent className="p-5"><FileUp className="size-6 text-primary"/><h3 className="mt-3 font-semibold">Importe e confira</h3><p className="mt-1 text-sm text-muted-foreground">Faturas e exames entram como prévia para você corrigir e aprovar.</p></CardContent></Card><Card><CardContent className="p-5"><BellRing className="size-6 text-primary"/><h3 className="mt-3 font-semibold">Não deixe passar</h3><p className="mt-1 text-sm text-muted-foreground">Alertas de contas, garantias, manutenção, vacinas e lembretes.</p></CardContent></Card></div></section>
    <section id="modulos" className="border-y bg-muted/30"><div className="mx-auto max-w-6xl px-4 py-16"><p className="text-sm font-semibold text-primary">MÓDULOS</p><h2 className="mt-2 text-3xl font-bold">Cada parte da rotina, no seu lugar.</h2><p className="mt-2 text-sm text-muted-foreground">Clique em um módulo para ver mais detalhes, sem sair desta página.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modulos.map(({icon:Icon,titulo,texto,detalhes})=><Card key={titulo} className="overflow-hidden"><Accordion type="single" collapsible><AccordionItem value={titulo} className="border-b-0"><CardContent className="p-5 pb-0"><Icon className="size-6 text-primary"/><h3 className="mt-3 font-semibold">{titulo}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{texto}</p></CardContent><AccordionTrigger className="px-5 py-2 text-xs text-primary hover:no-underline">Ver detalhes</AccordionTrigger><AccordionContent className="px-5"><ul className="space-y-1.5 text-sm text-muted-foreground">{detalhes.map((d)=><li key={d} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-primary"/>{d}</li>)}</ul></AccordionContent></AccordionItem></Accordion></Card>)}</div></div></section>
    <section id="demonstracao" className="mx-auto max-w-6xl px-4 py-16"><div className="grid items-center gap-8 md:grid-cols-2"><div><p className="text-sm font-semibold text-primary">DEMONSTRAÇÃO</p><h2 className="mt-2 text-3xl font-bold">Veja antes de decidir.</h2><p className="mt-4 text-muted-foreground">Esta área é visual e segura, com lançamentos fictícios — sem expor dados reais de nenhuma pessoa.</p>{!videoUrl && <Button className="mt-6" variant="outline" disabled><PlayCircle className="size-4" /> Vídeo de apresentação em breve</Button>}</div>{videoUrl ? (<Card className="overflow-hidden p-0"><video src={videoUrl} controls preload="metadata" className="aspect-video w-full bg-black" /></Card>) : (<Card className="border-dashed"><CardContent className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><PlayCircle className="size-11 text-primary"/><b className="mt-3">Demonstração visual do Control ALL</b><p className="mt-1 text-sm text-muted-foreground">Vídeos e telas fictícias serão exibidos aqui.</p></CardContent></Card>)}</div></section>
    <section id="precos" className="border-t bg-primary/5"><div className="mx-auto max-w-6xl px-4 py-16 text-center"><p className="text-sm font-semibold text-primary">PREÇOS</p><h2 className="mt-2 text-3xl font-bold">Simples para começar.</h2><Card className="mx-auto mt-7 max-w-sm border-primary"><CardContent className="p-7"><p className="font-semibold">Control ALL</p><p className="mt-3 text-4xl font-bold">R$ 4,99<span className="text-base font-normal text-muted-foreground">/mês</span></p><p className="mt-3 text-sm text-muted-foreground">Preço de lançamento previsto.</p><ul className="mt-5 space-y-2 text-left text-sm">{["Módulos pessoais e financeiros","Alertas e histórico","Compartilhamento controlado","Privacidade por padrão"].map(i=><li className="flex gap-2" key={i}><Check className="size-4 text-primary"/>{i}</li>)}</ul><Button asChild className="mt-6 w-full"><Link to="/entrar" search={{ criar: true }}>Criar conta</Link></Button></CardContent></Card></div></section>
    <ConsultaProtocolo />
    <footer className="flex items-center justify-center gap-2 border-t px-4 py-7 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Control ALL LTDA · <LegalDialogs compact /></footer>
  </main>;
}
