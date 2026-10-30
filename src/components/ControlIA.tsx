import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Mic, MicOff, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCotacao } from "@/hooks/useCotacao";
import { useCartoes, useDespesas, useFaturasMes, useReceitas } from "@/hooks/useFinance";
import { supabase } from "@/integrations/supabase/client";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { monthKey, toBRL } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { usePreferencias } from "@/hooks/usePreferencias";
import { listarCaixinhas, metaDoMes } from "@/lib/poupar";
import { calcularPrevisaoMes } from "@/lib/previsao-mes";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";
import { registrarEventoUso } from "@/lib/registrar-uso";
import { cn } from "@/lib/utils";

/** Telas do site que o ControlIA pode abrir (rota e nome). */
const TELAS: { rota: string; titulo: string }[] = [
  { rota: "/inicio", titulo: "Início" },
  { rota: "/dashboard", titulo: "Finanças (visão geral)" },
  { rota: "/despesas", titulo: "Despesas" },
  { rota: "/receitas", titulo: "Receitas" },
  { rota: "/cartoes", titulo: "Cartões e faturas" },
  { rota: "/caixinhas", titulo: "Caixinhas (guardar dinheiro)" },
  { rota: "/investimentos", titulo: "Investimentos" },
  { rota: "/para-onde-vai", titulo: "Para onde vai o dinheiro" },
  { rota: "/importar", titulo: "Importar fatura" },
  { rota: "/categorias", titulo: "Categorias" },
  { rota: "/calendario", titulo: "Calendário" },
  { rota: "/lista-compras", titulo: "Lista de compras" },
  { rota: "/notas", titulo: "Notas fiscais e garantias" },
  { rota: "/onde-esta", titulo: "Onde está" },
  { rota: "/veiculos", titulo: "Veículos" },
  { rota: "/pets", titulo: "Pets" },
  { rota: "/exames", titulo: "Exames" },
  { rota: "/links", titulo: "Anotações e links" },
  { rota: "/ferramentas", titulo: "Calculadora" },
  { rota: "/configuracoes", titulo: "Configurações" },
  { rota: "/conta", titulo: "Minha conta" },
  { rota: "/suporte", titulo: "Suporte" },
];
const rotaValida = (r: unknown) => (typeof r === "string" && TELAS.some((t) => t.rota === r.trim()) ? r.trim() : null);

type Msg = { papel: "user" | "assistant"; texto: string; links?: { rotulo: string; rota: string }[]; lancar?: boolean; erro?: boolean };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * ControlIA (27/10/2026): assistente por voz ou texto para o site todo. Responde com um resumo,
 * uma orientação ou o atalho para a tela certa.
 * Segurança: o contexto é montado aqui com o login da própria pessoa (as regras de acesso do banco
 * só devolvem os dados do grupo dela) e vai para a mesma função `assistente-ia` do app, que confere
 * o login e não busca dados financeiros por conta própria. Nunca há dados de outra conta.
 */
export function ControlIA({ flutuante = true }: { flutuante?: boolean }) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const reconhecimento = useRef<any>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener("abrir-controlia", abrir);
    return () => window.removeEventListener("abrir-controlia", abrir);
  }, []);
  useEffect(() => fim.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  const contexto = useContexto(aberto);
  const vozDisponivel = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  function ouvir() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (ouvindo) {
      reconhecimento.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const fala = String(e.results?.[0]?.[0]?.transcript ?? "").trim();
      if (fala) void enviar(fala, "audio");
    };
    r.onend = () => setOuvindo(false);
    r.onerror = () => setOuvindo(false);
    reconhecimento.current = r;
    setOuvindo(true);
    r.start();
  }

  function irPara(rota: string) {
    if (typeof window !== "undefined" && window.innerWidth < 1024) setAberto(false);
    void navigate({ to: rota as never });
  }

  async function enviar(pergunta?: string, origem: "texto" | "audio" = "texto") {
    const p = (pergunta ?? texto).trim();
    if (!p || enviando) return;
    setTexto("");
    const historico = msgs.slice(-6).map((m) => ({ role: m.papel, content: m.texto }));
    setMsgs((m) => [...m, { papel: "user", texto: p }]);
    setEnviando(true);
    registrarEventoUso(`controlia/pergunta-${origem}`);
    try {
      const { data, error } = await supabase.functions.invoke("assistente-ia", {
        body: { pergunta: p, historico, contexto, origem },
      });
      if (error) throw new Error("Não consegui falar com a IA agora. Tente de novo em instantes.");
      if (!data?.ok) throw new Error(data?.erro?.mensagem ?? "Não consegui responder agora.");
      const links = (Array.isArray(data.links) ? data.links : [])
        .map((l: any) => ({ rotulo: String(l?.rotulo ?? "Abrir"), rota: rotaValida(l?.rota) }))
        .filter((l: any, i: number, arr: any[]) => l.rota && arr.findIndex((x: any) => x.rota === l.rota) === i) as { rotulo: string; rota: string }[];
      const abrir = data.acao?.tipo === "abrir" ? rotaValida(data.acao.rota) : null;
      if (abrir && !links.some((l) => l.rota === abrir)) links.unshift({ rotulo: TELAS.find((t) => t.rota === abrir)?.titulo ?? "Abrir", rota: abrir });
      setMsgs((m) => [...m, { papel: "assistant", texto: String(data.resposta ?? ""), links, lancar: !!data.rascunho?.tipo }]);
      // Pedido explícito de abrir: abre a tela e a conversa continua aberta ao lado (no celular, fecha para ver a tela).
      if (abrir) irPara(abrir);
    } catch (e) {
      setMsgs((m) => [...m, { papel: "assistant", texto: e instanceof Error ? e.message : "Não consegui responder agora.", erro: true }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {flutuante && (
        <Button
          onClick={() => {
            registrarEventoUso("controlia/abrir");
            setAberto(true);
          }}
          className="fixed bottom-6 right-4 z-40 hidden h-14 gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 text-base font-bold text-white shadow-lg hover:brightness-110 lg:inline-flex native:hidden"
          aria-label="Abrir o ControlIA"
          title="ControlIA: pergunte por voz ou texto"
        >
          <Sparkles className="size-5" /> ControlIA
        </Button>
      )}
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <div className="flex items-center gap-2 border-b p-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
              <Sparkles className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">ControlIA</SheetTitle>
              <p className="text-xs text-muted-foreground">Pergunte sobre qualquer parte do site. Só com os seus dados.</p>
            </div>
            {msgs.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setMsgs([])}>
                Nova conversa
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setAberto(false)} aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Exemplos:</p>
                {["Quanto sobra este mês?", "Quais faturas vencem esta semana?", "Onde cadastro meus cartões?", "Abrir minha lista de compras"].map((s) => (
                  <button key={s} type="button" onClick={() => void enviar(s)} className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn("max-w-[90%] rounded-2xl px-3 py-2 text-sm", m.papel === "user" ? "ml-auto bg-primary text-primary-foreground" : m.erro ? "bg-rose-500/10 text-rose-700" : "bg-muted")}>
                <p className="whitespace-pre-wrap">{m.texto}</p>
                {!!m.links?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.links.map((l) => (
                      <button
                        key={l.rota}
                        type="button"
                        onClick={() => irPara(l.rota)}
                        className="rounded-full border border-primary/40 bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        {l.rotulo} →
                      </button>
                    ))}
                  </div>
                )}
                {m.lancar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      window.dispatchEvent(new Event("abrir-lancamento-rapido"));
                    }}
                    className="mt-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  >
                    Abrir o lançamento para conferir
                  </button>
                )}
              </div>
            ))}
            {enviando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <div ref={fim} />
          </div>
          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            {vozDisponivel && (
              <Button type="button" variant={ouvindo ? "default" : "outline"} size="icon" onClick={ouvir} aria-label={ouvindo ? "Parar de ouvir" : "Falar"} className={cn(ouvindo && "animate-pulse bg-rose-600")}>
                {ouvindo ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
            )}
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={ouvindo ? "Ouvindo…" : "Pergunte ou peça para abrir uma tela"} maxLength={500} />
            <Button type="submit" size="icon" disabled={!texto.trim() || enviando} aria-label="Enviar">
              <Send className="size-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Contexto com os dados da própria pessoa (mesmo formato do app), montado só quando o ControlIA abre. */
function useContexto(ativo: boolean) {
  const cotacao = useCotacao();
  const mes = useCompetenciaVigente();
  const { prefs: prefsVirada } = usePreferencias();
  const { data: despesas = [] } = useDespesas();
  const { data: receitas = [] } = useReceitas();
  const { data: faturas = [] } = useFaturasMes();
  const { data: cartoes = [] } = useCartoes();
  const { data: caixinhas = [] } = useQuery({ queryKey: ["caixinhas"], queryFn: listarCaixinhas, enabled: ativo, retry: false });
  const { data: compras = [] } = useQuery({
    queryKey: ["controlia-lista-compras"],
    enabled: ativo,
    queryFn: async () => {
      const { data } = await (supabase as any).from("lista_compras").select("nome,quantidade,comprado").eq("comprado", false).limit(25);
      return (data ?? []) as any[];
    },
  });
  return useMemo(() => {
    if (!ativo) return null;
    const prev = calcularPrevisaoMes({ despesas: despesas as any[], receitas: receitas as any[], faturas: faturas as any[], cotacao }, mes, metaDoMes(caixinhas, mes), prefsVirada.dia_virada, prefsVirada.receitas_proximo_ciclo_dia);
    const hoje = new Date().toISOString().slice(0, 10);
    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const proximoMes = monthKey(new Date(Date.now() + 31 * 86400000));
    const parcelas = aplicarRegrasFaturaMes(lancamentosPorCompetencias(despesas as any[], [mes, proximoMes]), faturas as any[]);
    const doMes = parcelas.filter((p: any) => monthKey(p.vencimento) === mes);
    const porCat = new Map<string, number>();
    for (const p of doMes as any[]) porCat.set(p.despesa.categoria ?? "Outros", (porCat.get(p.despesa.categoria ?? "Outros") ?? 0) + toBRL(Number(p.valor), p.despesa.moeda, cotacao));
    const proximos = (parcelas as any[])
      .filter((p) => !p.paga && p.vencimento >= hoje && p.vencimento <= em30)
      .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))
      .slice(0, 15)
      .map((p) => ({ descricao: p.despesa.descricao, vencimento: p.vencimento, valor: r2(toBRL(Number(p.valor), p.despesa.moeda, cotacao)) }));
    return {
      hoje,
      plataforma: "site",
      telas: TELAS,
      dados: {
        mes,
        previsaoDoMes: {
          receitas: prev.receitas,
          despesasComprometidas: prev.comprometido,
          aGuardarNasCaixinhas: prev.meta,
          saldoLivre: prev.saldoLivre,
          podeGastarPorDia: prev.porDia,
          fimDoMesPrevisto: prev.finalPrevisto,
        },
        topCategoriasDoMes: [...porCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([categoria, valor]) => ({ categoria, valor: r2(valor) })),
        proximosVencimentos30dias: proximos,
        cartoesCadastrados: (cartoes as any[]).map((c) => `${c.apelido ?? "Cartão"} final ${c.final ?? ""}`),
        caixinhas: caixinhas.slice(0, 10).map((x) => ({ objetivo: x.nome, porMes: r2(x.valorMensal) })),
        listaDeComprasPendente: compras.map((i: any) => ({ item: i.nome, quantidade: i.quantidade })),
      },
    };
  }, [ativo, despesas, receitas, faturas, cartoes, caixinhas, compras, cotacao, mes, prefsVirada.dia_virada, prefsVirada.receitas_proximo_ciclo_dia]);
}
