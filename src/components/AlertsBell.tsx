import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, ChevronRight, Settings2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { alertasDosVeiculos } from "@/lib/veiculo-alertas";
import { diasRestantes } from "@/lib/nfe";
import { proximaVirada } from "@/lib/periodo-vigente";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useServerFn } from "@tanstack/react-start";
import {
  limparVersoesSite,
  meuHistoricoAlertas,
  minhasChavesAlertasLidos,
  marcarAlertasLidosLote,
  versoesAtivasSite,
} from "@/lib/comunicados.functions";
import { useIsSiteAdmin } from "@/hooks/useAuthData";
import { useAlertasLimites } from "@/hooks/useAlertasLimites";
import {
  lembreteLiberado,
  usePreferenciasNotificacao,
  type LembreteChave,
} from "@/hooks/usePreferenciasNotificacao";
import { useModoCliente } from "@/lib/modo-cliente";
import {
  agendarLembretesNoApp,
  ehAppNativo,
  momentoLembrete,
  ponteNativa,
  type LembreteApp,
} from "@/lib/app-nativo";

type Aviso = {
  chave: string;
  texto: string;
  destino?: "/notas" | "/veiculos" | "/lista-compras" | "/cartoes" | "/despesas" | "/limites";
};

// Fatura de cartão (fechamento/vencimento, pedido explícito do usuário em
// 2026-10-02): limiares mais curtos que os de garantia/veículo (crítico
// ≤15/atenção ≤30 dias) porque o ciclo é mensal — um limiar de 30 dias
// disparia quase sempre, pra qualquer cartão, o tempo todo.
const LIMIAR_ATENCAO_FATURA_DIAS = 7;
const LIMIAR_CRITICO_FATURA_DIAS = 3;
// Contas/parcelas a vencer (idem, pedido explícito do usuário): mesma
// janela e limiares já usados pra garantia de nota fiscal e alertas do
// veículo (crítico ≤15/atenção ≤30 dias), aplicados sobre `parcelas` reais
// não pagas — nunca projeta parcela que não existe de verdade.
const JANELA_PARCELAS_DIAS = 30;

export function AlertsBell() {
  const historicoFn = useServerFn(meuHistoricoAlertas);
  const chavesFn = useServerFn(minhasChavesAlertasLidos);
  const marcarLoteFn = useServerFn(marcarAlertasLidosLote);
  const [aberto, setAberto] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const versoesFn = useServerFn(versoesAtivasSite);
  const limparFn = useServerFn(limparVersoesSite);
  const { data: isSiteAdminRaw } = useIsSiteAdmin();
  const modoCliente = useModoCliente();
  const isSiteAdminUser = !!isSiteAdminRaw && !modoCliente;
  // 07/11/2026: preferências de notificação filtram os lembretes locais do app (lidas por ref
  // dentro da consulta dos alertas; ao mudar, a consulta roda de novo e reagenda).
  const { prefs: prefsNotif } = usePreferenciasNotificacao();
  const prefsNotifRef = useRef(prefsNotif);
  prefsNotifRef.current = prefsNotif;
  const assinaturaPrefs = JSON.stringify(prefsNotif);
  const alertasLimites = useAlertasLimites();
  // Dentro do app do iPhone: sem avisos de deploy do site e com botão de testar notificação.
  const [ehApp, setEhApp] = useState(false);
  useEffect(() => {
    setEhApp(ehAppNativo());
    const aoResponder = (ev: Event) => {
      const r = (ev as CustomEvent<{ ok: boolean; erro?: string }>).detail;
      if (!r?.ok) toast.error(r?.erro ?? "Não consegui agendar a notificação de teste.");
    };
    window.addEventListener("notificacao-app-resultado", aoResponder);
    return () => window.removeEventListener("notificacao-app-resultado", aoResponder);
  }, []);
  function testarNotificacao() {
    const ponte = ponteNativa("notificacoesApp");
    if (!ponte) {
      toast.error("Atualize o app pelo TestFlight para testar notificações.");
      return;
    }
    ponte.postMessage({ acao: "testar" });
    toast.success("Bloqueie a tela agora: a notificação chega em 5 segundos.");
  }
  const { data: versoes = [], refetch: refetchVersoes } = useQuery({
    queryKey: ["versoes-site"],
    queryFn: () => versoesFn(),
  });
  const { data: chavesLidas = [], refetch: refetchLidas } = useQuery({
    queryKey: ["alertas-lidos"],
    queryFn: () => chavesFn(),
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["historico-alertas"],
    queryFn: () => historicoFn(),
  });
  const { data: avisos = [], refetch: refetchAvisos } = useQuery({
    queryKey: ["alertas-globais"],
    queryFn: async (): Promise<Aviso[]> => {
      const [veiculos, notas, compras, cartoes, parcelas] = await Promise.all([
        supabase
          .from("veiculos")
          .select(
            "id,nome,km_atual,km_proxima_troca_oleo,data_proxima_troca_oleo,data_vencimento_ipva,data_vencimento_seguro",
          ),
        supabase
          .from("notas_fiscais")
          .select("id,estabelecimento,descricao,garantia_fim")
          .not("garantia_fim", "is", null),
        supabase
          .from("lista_compras")
          .select("id,nome,comprado,aprovacoes_necessarias,aprovado_por,alerta_em")
          .eq("comprado", false),
        supabase.from("cartoes").select("id,apelido,dia_fechamento,dia_vencimento"),
        supabase
          .from("parcelas")
          .select("id,vencimento,despesas(descricao,cartao_id)")
          .eq("paga", false)
          .order("vencimento", { ascending: true })
          .limit(200),
      ]);
      if (veiculos.error || notas.error || compras.error || cartoes.error || parcelas.error)
        throw new Error("Não foi possível carregar os alertas.");
      const alertas: Aviso[] = alertasDosVeiculos(veiculos.data ?? []).map((alerta) => {
        const veiculo = (veiculos.data ?? []).find((item) => item.id === alerta.veiculoId);
        const referencia =
          alerta.tipo === "oleo"
            ? `${veiculo?.km_proxima_troca_oleo ?? ""}:${veiculo?.data_proxima_troca_oleo ?? ""}`
            : alerta.tipo === "ipva"
              ? veiculo?.data_vencimento_ipva
              : veiculo?.data_vencimento_seguro;
        return {
          chave: `veiculo:${alerta.veiculoId}:${alerta.tipo}:${referencia ?? "sem-data"}`,
          texto: `${alerta.veiculoNome}: ${alerta.mensagem}`,
          destino: "/veiculos",
        };
      });
      for (const nota of notas.data ?? []) {
        if (!nota.garantia_fim) continue;
        const dias = diasRestantes(nota.garantia_fim);
        if (dias !== null && dias >= -30 && dias <= 30)
          alertas.push({
            chave: `garantia:${nota.id}:${nota.garantia_fim}`,
            texto: `${nota.estabelecimento ?? nota.descricao ?? "Nota fiscal"}: garantia ${dias < 0 ? `vencida há ${Math.abs(dias)} dias` : `vence em ${dias} dias`}`,
            destino: "/notas",
          });
      }
      for (const compra of compras.data ?? []) {
        const aprovadores = Array.isArray(compra.aprovado_por) ? compra.aprovado_por : [];
        if (
          (compra.aprovacoes_necessarias ?? 0) > 0 &&
          aprovadores.length >= (compra.aprovacoes_necessarias ?? 0)
        ) {
          alertas.push({
            chave: `compra-aprovada:${compra.id}:${aprovadores.length}`,
            texto: `${compra.nome}: compra aprovada`,
            destino: "/lista-compras",
          });
        } else if (compra.alerta_em && compra.alerta_em <= new Date().toISOString().slice(0, 10)) {
          alertas.push({
            chave: `compra-alerta:${compra.id}:${compra.alerta_em}`,
            texto: `${compra.nome}: lembrete da lista de compras`,
            destino: "/lista-compras",
          });
        }
      }
      // Fatura de cartão fechando/vencendo em breve — pedido explícito do
      // usuário em 2026-10-02 (central de avisos, item "notificações").
      const hoje = new Date();
      for (const cartao of cartoes.data ?? []) {
        const checagens: { tipo: string; dia: number | null; rotulo: string }[] = [
          { tipo: "fechamento", dia: cartao.dia_fechamento, rotulo: "Fechamento da fatura" },
          { tipo: "vencimento", dia: cartao.dia_vencimento, rotulo: "Vencimento da fatura" },
        ];
        for (const c of checagens) {
          if (!c.dia) continue;
          const proxima = proximaVirada(hoje, c.dia);
          const dias = Math.round(
            (proxima.getTime() - new Date(hoje.toDateString()).getTime()) / 86400000,
          );
          if (dias > LIMIAR_ATENCAO_FATURA_DIAS) continue;
          alertas.push({
            chave: `cartao:${cartao.id}:${c.tipo}:${proxima.toISOString().slice(0, 10)}`,
            texto: `${cartao.apelido}: ${c.rotulo.toLowerCase()} ${dias === 0 ? "é hoje" : `em ${dias}d`}${dias <= LIMIAR_CRITICO_FATURA_DIAS ? " !" : ""}`,
            destino: "/cartoes",
          });
        }
      }
      // Contas e parcelas a vencer — mesmo pedido, só parcelas reais e não
      // pagas (nunca inventa parcela projetada de despesa fixa sem prazo).
      for (const parcela of parcelas.data ?? []) {
        const dias = diasRestantes(parcela.vencimento);
        if (dias === null || dias < -JANELA_PARCELAS_DIAS || dias > JANELA_PARCELAS_DIAS) continue;
        const descricao = (parcela as { despesas?: { descricao?: string } | null }).despesas
          ?.descricao;
        alertas.push({
          chave: `parcela:${parcela.id}:${parcela.vencimento}`,
          texto: `${descricao ?? "Despesa"}: parcela ${
            dias < 0
              ? `venceu há ${Math.abs(dias)}d`
              : dias === 0
                ? "vence hoje"
                : `vence em ${dias}d`
          }`,
          destino: "/despesas",
        });
      }
      // No app do iPhone: agenda notificações na tela de bloqueio para os próximos vencimentos
      // (funciona com o app fechado, sem servidor de push). No navegador não faz nada.
      if (ehAppNativo()) {
        // Cada lembrete leva a chave de preferência correspondente (null = sem chave em lembretes).
        // Mapa: fatura vence (véspera/dia) e contas a vencer = despesa_perto_vencer;
        // fatura fecha hoje = revisar_faturas; garantia de nota fiscal = garantia_vencendo.
        const lembretes: (LembreteApp & { tipo: LembreteChave | null })[] = [];
        const hojeLocal = new Date();
        for (const cartao of cartoes.data ?? []) {
          const nome = cartao.apelido || "cartão";
          if (cartao.dia_vencimento) {
            const venc = proximaVirada(new Date(hojeLocal.getTime() - 86400000), cartao.dia_vencimento);
            lembretes.push(
              { id: `fatura-${cartao.id}-vespera`, titulo: "Fatura vence amanhã", corpo: `A fatura do ${nome} vence amanhã.`, quando: momentoLembrete(venc, 9, 1), destino: "/despesas", tipo: "despesa_perto_vencer" },
              { id: `fatura-${cartao.id}-dia`, titulo: "Fatura vence hoje", corpo: `A fatura do ${nome} vence hoje.`, quando: momentoLembrete(venc, 9, 0), destino: "/despesas", tipo: "despesa_perto_vencer" },
            );
          }
          if (cartao.dia_fechamento) {
            const fecha = proximaVirada(new Date(hojeLocal.getTime() - 86400000), cartao.dia_fechamento);
            lembretes.push({ id: `fechamento-${cartao.id}`, titulo: "Fatura fecha hoje", corpo: `A fatura do ${nome} fecha hoje. Compras a partir de agora vão para a próxima.`, quando: momentoLembrete(fecha, 9, 0), destino: "/despesas", tipo: "revisar_faturas" });
          }
        }
        // Contas fora do cartão (o cartão já é avisado pela fatura), agrupadas por dia.
        const porDia = new Map<string, string[]>();
        for (const parcela of parcelas.data ?? []) {
          const despesa = (parcela as { despesas?: { descricao?: string; cartao_id?: string | null } | null }).despesas;
          if (despesa?.cartao_id) continue;
          const dia = String(parcela.vencimento).slice(0, 10);
          porDia.set(dia, [...(porDia.get(dia) ?? []), despesa?.descricao ?? "Conta"]);
        }
        for (const [dia, nomes] of porDia) {
          const resumo = nomes.length === 1 ? nomes[0]! : `${nomes.length} contas (${nomes.slice(0, 3).join(", ")}${nomes.length > 3 ? "…" : ""})`;
          lembretes.push(
            { id: `contas-${dia}-vespera`, titulo: "Conta vence amanhã", corpo: `${resumo} vence amanhã.`, quando: momentoLembrete(dia, 9, 1), destino: "/despesas", tipo: "despesa_perto_vencer" },
            { id: `contas-${dia}-dia`, titulo: "Conta vence hoje", corpo: `${resumo} vence hoje.`, quando: momentoLembrete(dia, 9, 0), destino: "/despesas", tipo: "despesa_perto_vencer" },
          );
        }
        for (const nota of notas.data ?? []) {
          if (!nota.garantia_fim) continue;
          const nome = nota.estabelecimento ?? nota.descricao ?? "compra";
          lembretes.push({ id: `garantia-${nota.id}`, titulo: "Garantia termina em 7 dias", corpo: `A garantia de ${nome} termina em 7 dias.`, quando: momentoLembrete(nota.garantia_fim, 9, 7), destino: "/notas", tipo: "garantia_vencendo" });
        }
        const prefsAgora = prefsNotifRef.current;
        agendarLembretesNoApp(
          lembretes
            .filter((l) => lembreteLiberado(prefsAgora, l.tipo, l.quando))
            .map(({ tipo: _tipo, ...l }) => l),
        );
      }
      return alertas.slice(0, 50);
    },
    refetchInterval: 60_000,
  });
  // Preferências mudaram: refaz a consulta para reagendar os lembretes do app com o filtro novo.
  const primeiraAssinatura = useRef(assinaturaPrefs);
  useEffect(() => {
    if (primeiraAssinatura.current === assinaturaPrefs) return;
    primeiraAssinatura.current = assinaturaPrefs;
    if (ehAppNativo()) void refetchAvisos();
  }, [assinaturaPrefs, refetchAvisos]);
  const avisosComVersao: Aviso[] = [
    ...avisos,
    ...alertasLimites,
    ...(ehApp ? [] : versoes).map((v: any) => ({
      chave: `versao:${v.versao}`,
      texto: `Nova versão publicada: build ${v.versao} · ${new Date(v.build_em ?? v.criado_em).toLocaleString("pt-BR")}`,
    })),
  ];
  // 03/11/2026: alertas limpos pelo usuário (tabela alertas_ocultos, RLS por usuário) saem da lista.
  // Lidos e limpos são independentes: ler não tira da lista, limpar tira.
  const { data: ocultos = [], refetch: refetchOcultos } = useQuery({
    queryKey: ["alertas-ocultos"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("alertas_ocultos").select("chave");
      if (error) throw error;
      return (data ?? []).map((r) => r.chave);
    },
  });
  const visiveis = avisosComVersao.filter((aviso) => !ocultos.includes(aviso.chave));
  const naoLidos = visiveis.filter((aviso) => !chavesLidas.includes(aviso.chave));
  const itensSelecionados = visiveis.filter((aviso) => selecionados.includes(aviso.chave));

  async function marcarLidos(itens: Aviso[]) {
    const pendentes = itens.filter((aviso) => !chavesLidas.includes(aviso.chave));
    if (pendentes.length === 0) return;
    await marcarLoteFn({
      data: {
        itens: pendentes.slice(0, 60).map((a) => ({
          chave: a.chave,
          titulo: a.chave.startsWith("versao:") ? "Atualização do Control ALL" : "Alerta do Control ALL",
          mensagem: a.texto,
        })),
      },
    });
    await refetchLidas();
  }

  async function limpar(itens: Aviso[]) {
    if (itens.length === 0) return;
    const { data: sess } = await supabase.auth.getUser();
    const uid = sess.user?.id;
    if (!uid) {
      toast.error("Entre de novo para limpar os alertas.");
      return;
    }
    const { error } = await supabase
      .from("alertas_ocultos")
      .upsert(itens.map((a) => ({ user_id: uid, chave: a.chave })), { onConflict: "user_id,chave" });
    if (error) {
      toast.error("Não consegui limpar os alertas. Tente de novo.");
      return;
    }
    setSelecionados([]);
    setSelecionando(false);
    await refetchOcultos();
  }

  function confirmarLimpeza(itens: Aviso[]) {
    if (itens.length === 0) return;
    const quantos = `${itens.length} alerta${itens.length === 1 ? "" : "s"}`;
    if (!window.confirm(`Tirar ${quantos} da lista? O histórico continua salvo.`)) return;
    void limpar(itens);
  }

  function alternarSelecao(chave: string) {
    setSelecionados((s) => (s.includes(chave) ? s.filter((x) => x !== chave) : [...s, chave]));
  }

  function aoAbrir(valor: boolean) {
    setAberto(valor);
    if (!valor) {
      setSelecionando(false);
      setSelecionados([]);
    }
  }

  return (
    <Popover open={aberto} onOpenChange={aoAbrir}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${naoLidos.length} alertas não lidos`}
          title="Alertas"
          className="relative size-9 rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Bell className="size-4.5" />
          {naoLidos.length > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs leading-none font-semibold tabular-nums text-destructive-foreground ring-2 ring-background">
              {naoLidos.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="flex max-h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border bg-background/95 shadow-lg backdrop-blur-xl p-2">
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <p className="text-sm font-semibold">
            Notificações <span className="font-normal tabular-nums text-muted-foreground">{visiveis.length}</span>
          </p>
          {visiveis.length > 0 && (
            <button
              type="button"
              className="rounded-md px-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              onClick={() => {
                setSelecionando((s) => !s);
                setSelecionados([]);
              }}
            >
              {selecionando ? "Cancelar" : "Selecionar"}
            </button>
          )}
        </div>
        {visiveis.length > 0 && !selecionando && (
          <div className="flex flex-wrap gap-4 px-3 pb-2 text-xs">
            {naoLidos.length > 0 && (
              <button type="button" className="rounded-md text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" onClick={() => void marcarLidos(visiveis)}>
                Marcar todas como lidas
              </button>
            )}
            <button type="button" className="rounded-md text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" onClick={() => confirmarLimpeza(visiveis)}>
              Limpar tudo
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visiveis.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="size-4.5" aria-hidden="true" />
              </span>
              <p className="text-sm text-muted-foreground">Nenhuma notificação por enquanto</p>
            </div>
          ) : (
            visiveis.map((aviso) => {
              const lido = chavesLidas.includes(aviso.chave);
              const marcado = selecionados.includes(aviso.chave);
              return (
                <div key={aviso.chave} className="flex min-h-10 items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted">
                  {selecionando && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={marcado}
                      onChange={() => alternarSelecao(aviso.chave)}
                      aria-label="Selecionar alerta"
                    />
                  )}
                  <div className={`min-w-0 flex-1 ${lido ? "text-muted-foreground" : ""}`}>
                    {aviso.destino && !selecionando ? (
                      <Link
                        to={aviso.destino}
                        onClick={() => {
                          void marcarLidos([aviso]);
                          setAberto(false);
                        }}
                        className="block"
                      >
                        {aviso.texto}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => (selecionando ? alternarSelecao(aviso.chave) : void marcarLidos([aviso]))}
                      >
                        {aviso.texto}
                      </button>
                    )}
                  </div>
                  {!lido && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="não lido" />}
                  {!selecionando && (
                    <button
                      type="button"
                      aria-label="Limpar alerta"
                      className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      onClick={() => confirmarLimpeza([aviso])}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        {selecionando && itensSelecionados.length > 0 && (
          <div className="mt-2 flex gap-2 border-t px-1 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                void marcarLidos(itensSelecionados);
                setSelecionados([]);
                setSelecionando(false);
              }}
            >
              Marcar lidos ({itensSelecionados.length})
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => confirmarLimpeza(itensSelecionados)}>
              Limpar ({itensSelecionados.length})
            </Button>
          </div>
        )}
        {isSiteAdminUser && versoes.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-10 w-full rounded-xl"
            onClick={() => void limparFn().then(() => refetchVersoes())}
          >
            Limpar versões para todos
          </Button>
        )}
        {ehApp && (
          <Button variant="outline" size="sm" className="mt-2 h-10 w-full rounded-xl" onClick={testarNotificacao}>
            Testar notificação no iPhone
          </Button>
        )}
        {historico.length > 0 && (
          <>
            <p className="mt-2 border-t px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
              Histórico (últimos 7 dias)
            </p>
            {historico.slice(0, 8).map((aviso: any) => (
              <div key={aviso.id} className="rounded-xl px-3 py-2 text-sm">
                <p className="font-medium">{aviso.titulo}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{aviso.mensagem}</p>
              </div>
            ))}
          </>
        )}
        <Link
          to="/notificacoes"
          onClick={() => setAberto(false)}
          className="mt-2 flex min-h-10 shrink-0 items-center gap-2 rounded-xl border-t px-3 pt-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Settings2 className="size-4" aria-hidden="true" />
          <span className="flex-1">Preferências de notificação</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
